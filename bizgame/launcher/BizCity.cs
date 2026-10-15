using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;

// Запускатор БизСити 3D: маленький веб-сервер для папки с игрой + окно управления.
// Браузер не открывает ES-модули с диска (file://), поэтому игре нужен сервер.
// Порт постоянный: сохранения браузер хранит отдельно для каждого адреса.

class GameServer
{
    public const int PreferredPort = 8777;
    readonly string root;
    TcpListener listener;
    volatile bool running;
    public int Port;
    public bool Lan;

    static readonly Dictionary<string, string> Mime = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { ".html", "text/html; charset=utf-8" }, { ".js", "text/javascript; charset=utf-8" },
        { ".mjs", "text/javascript; charset=utf-8" }, { ".css", "text/css; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" }, { ".md", "text/plain; charset=utf-8" },
        { ".txt", "text/plain; charset=utf-8" }, { ".png", "image/png" }, { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" }, { ".gif", "image/gif" }, { ".svg", "image/svg+xml" },
        { ".ico", "image/x-icon" }, { ".webp", "image/webp" }, { ".glb", "model/gltf-binary" },
        { ".gltf", "model/gltf+json" }, { ".mp3", "audio/mpeg" }, { ".ogg", "audio/ogg" },
        { ".wav", "audio/wav" }, { ".woff2", "font/woff2" },
    };

    public GameServer(string root) { this.root = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar; }

    // lan = true — пускать телефоны и другие компьютеры из той же Wi-Fi сети
    public void Start(bool lan)
    {
        Stop();
        IPAddress addr = lan ? IPAddress.Any : IPAddress.Loopback;
        int first = Port != 0 ? Port : PreferredPort;
        Exception last = null;
        for (int p = first; p < first + 20; p++)
        {
            try
            {
                TcpListener l = new TcpListener(addr, p);
                l.Start();
                listener = l; Port = p; Lan = lan; running = true;
                Thread t = new Thread(AcceptLoop);
                t.IsBackground = true;
                t.Start();
                return;
            }
            catch (SocketException e) { last = e; }
        }
        throw new Exception("Не удалось открыть порт " + first + "–" + (first + 19) + ": " + (last != null ? last.Message : ""));
    }

    public void Stop()
    {
        running = false;
        if (listener != null) { try { listener.Stop(); } catch { } listener = null; }
    }

    void AcceptLoop()
    {
        TcpListener l = listener;
        while (running)
        {
            TcpClient c;
            try { c = l.AcceptTcpClient(); }
            catch { break; }
            ThreadPool.QueueUserWorkItem(Handle, c);
        }
    }

    void Handle(object state)
    {
        TcpClient client = (TcpClient)state;
        try
        {
            client.ReceiveTimeout = 10000;
            NetworkStream ns = client.GetStream();
            string requestLine = ReadHeaders(ns);
            if (requestLine == null) return;
            string[] parts = requestLine.Split(' ');
            if (parts.Length < 2) return;
            string method = parts[0];
            if (method != "GET" && method != "HEAD") { Send(ns, 405, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Method not allowed"), true); return; }

            string path = parts[1];
            int q = path.IndexOfAny(new[] { '?', '#' });
            if (q >= 0) path = path.Substring(0, q);
            path = Uri.UnescapeDataString(path);
            if (path.EndsWith("/")) path += "index.html";
            string full = Path.GetFullPath(Path.Combine(root, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));
            if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase)) { Send(ns, 403, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Forbidden"), method == "GET"); return; }
            if (Directory.Exists(full)) { Redirect(ns, path + "/"); return; }
            // настройки сервера: если файла ещё нет — отдаём значения по умолчанию
            if (path == "/settings.json" && !File.Exists(full)) { Send(ns, 200, Mime[".json"], Encoding.UTF8.GetBytes(ServerSettings.Json(ServerSettings.DefaultDay)), method == "GET"); return; }
            if (!File.Exists(full)) { Send(ns, 404, "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Not found: " + path), method == "GET"); return; }

            string type;
            if (!Mime.TryGetValue(Path.GetExtension(full), out type)) type = "application/octet-stream";
            Send(ns, 200, type, File.ReadAllBytes(full), method == "GET");
        }
        catch { }
        finally { try { client.Close(); } catch { } }
    }

    static string ReadHeaders(Stream s)
    {
        StringBuilder sb = new StringBuilder();
        int b;
        while ((b = s.ReadByte()) != -1)
        {
            sb.Append((char)b);
            int n = sb.Length;
            if (b == '\n' && (n >= 2 && sb[n - 2] == '\n' || n >= 4 && sb[n - 2] == '\r' && sb[n - 3] == '\n')) break;
            if (n > 16384) return null;
        }
        string head = sb.ToString();
        int end = head.IndexOf('\n');
        return end < 0 ? null : head.Substring(0, end).TrimEnd('\r');
    }

    static void Send(Stream s, int code, string type, byte[] body, bool withBody)
    {
        string status = code == 200 ? "OK" : code == 403 ? "Forbidden" : code == 404 ? "Not Found" : "Method Not Allowed";
        string head = "HTTP/1.1 " + code + " " + status + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.Length +
            "\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n";
        byte[] h = Encoding.ASCII.GetBytes(head);
        s.Write(h, 0, h.Length);
        if (withBody) s.Write(body, 0, body.Length);
        s.Flush();
    }

    static void Redirect(Stream s, string to)
    {
        byte[] h = Encoding.ASCII.GetBytes("HTTP/1.1 301 Moved Permanently\r\nLocation: " + Uri.EscapeUriString(to) + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        s.Write(h, 0, h.Length);
    }

    public string LocalUrl { get { return "http://127.0.0.1:" + Port + "/"; } }

    public List<string> LanUrls()
    {
        List<string> list = new List<string>();
        try
        {
            foreach (IPAddress a in Dns.GetHostAddresses(Dns.GetHostName()))
                if (a.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(a))
                    list.Add("http://" + a + ":" + Port + "/");
        }
        catch { }
        return list;
    }
}

// Настройки сервера в bizgame/settings.json — игра перечитывает их каждые 20 секунд.
static class ServerSettings
{
    public const int DefaultDay = 60;
    public static string Path(string dir) { return System.IO.Path.Combine(dir, "settings.json"); }
    public static string Json(int daySeconds) { return "{\n  \"dayLengthSeconds\": " + daySeconds + "\n}\n"; }

    public static int ReadDay(string dir)
    {
        try
        {
            string text = File.ReadAllText(Path(dir));
            var m = System.Text.RegularExpressions.Regex.Match(text, "\"dayLengthSeconds\"\\s*:\\s*(\\d+)");
            if (m.Success) return Math.Max(5, int.Parse(m.Groups[1].Value));
        }
        catch { }
        return DefaultDay;
    }

    public static void WriteDay(string dir, int seconds)
    {
        File.WriteAllText(Path(dir), Json(seconds), new UTF8Encoding(false));
    }
}

class MainForm : Form
{
    readonly GameServer server;
    readonly string gameDir;
    readonly Label status = new Label();
    readonly CheckBox lanBox = new CheckBox();
    readonly TextBox lanText = new TextBox();
    readonly NumericUpDown dayBox = new NumericUpDown();
    readonly NotifyIcon tray = new NotifyIcon();
    bool trayHintShown;

    public MainForm(GameServer server, string gameDir)
    {
        this.server = server;
        this.gameDir = gameDir;
        Text = "БизСити 3D";
        Font = new Font("Segoe UI", 10f);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(460, 340);
        BackColor = Color.FromArgb(15, 23, 42);
        ForeColor = Color.FromArgb(226, 232, 240);
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        Label title = new Label();
        title.Text = "БизСити 3D";
        title.Font = new Font("Segoe UI", 18f, FontStyle.Bold);
        title.SetBounds(20, 14, 420, 40);
        Controls.Add(title);

        status.SetBounds(22, 56, 420, 44);
        status.ForeColor = Color.FromArgb(148, 163, 184);
        Controls.Add(status);

        Button play = MakeButton("▶  Играть", 20, 104, 200, 48, Color.FromArgb(59, 130, 246));
        play.Font = new Font("Segoe UI", 12f, FontStyle.Bold);
        play.Click += delegate { OpenGame(); };
        Controls.Add(play);

        Button folder = MakeButton("Папка игры", 232, 104, 208, 48, Color.FromArgb(51, 65, 85));
        folder.Click += delegate { Process.Start("explorer.exe", "\"" + gameDir + "\""); };
        Controls.Add(folder);

        lanBox.Text = "Играть с телефона (та же Wi-Fi сеть)";
        lanBox.SetBounds(22, 166, 420, 26);
        lanBox.CheckedChanged += delegate { ToggleLan(); };
        Controls.Add(lanBox);

        lanText.SetBounds(22, 196, 418, 26);
        lanText.ReadOnly = true;
        lanText.BorderStyle = BorderStyle.None;
        lanText.BackColor = BackColor;
        lanText.ForeColor = Color.FromArgb(250, 204, 21);
        lanText.Font = new Font("Consolas", 11f);
        Controls.Add(lanText);

        Label hint = new Label();
        hint.Text = "Пока это окно открыто (или свёрнуто в трей), игра работает.\nСохранения хранятся в браузере.";
        Label dayLabel = new Label();
        dayLabel.Text = "Длина игрового дня, секунд:";
        dayLabel.SetBounds(22, 238, 250, 26);
        Controls.Add(dayLabel);
        dayBox.SetBounds(280, 235, 90, 26);
        dayBox.Minimum = 5; dayBox.Maximum = 86400; dayBox.Increment = 10;
        dayBox.Value = ServerSettings.ReadDay(gameDir);
        dayBox.ValueChanged += delegate
        {
            try { ServerSettings.WriteDay(gameDir, (int)dayBox.Value); }
            catch (Exception e) { MessageBox.Show("Не удалось сохранить настройки: " + e.Message, Text); }
        };
        Controls.Add(dayBox);

        hint.SetBounds(22, 278, 420, 44);
        hint.ForeColor = Color.FromArgb(100, 116, 139);
        hint.Font = new Font("Segoe UI", 9f);
        Controls.Add(hint);

        tray.Icon = Icon ?? SystemIcons.Application;
        tray.Text = "БизСити 3D";
        ContextMenu menu = new ContextMenu();
        menu.MenuItems.Add("Играть", delegate { OpenGame(); });
        menu.MenuItems.Add("Показать окно", delegate { RestoreWindow(); });
        menu.MenuItems.Add("-");
        menu.MenuItems.Add("Выход", delegate { Close(); });
        tray.ContextMenu = menu;
        tray.DoubleClick += delegate { RestoreWindow(); };

        Resize += delegate
        {
            if (WindowState != FormWindowState.Minimized) return;
            Hide();
            tray.Visible = true;
            if (!trayHintShown) { tray.ShowBalloonTip(3000, "БизСити 3D", "Игра работает в фоне. Двойной клик по значку — открыть окно.", ToolTipIcon.Info); trayHintShown = true; }
        };
        FormClosed += delegate { tray.Visible = false; server.Stop(); };
        Shown += delegate { UpdateStatus(); OpenGame(); };
    }

    Button MakeButton(string text, int x, int y, int w, int h, Color back)
    {
        Button b = new Button();
        b.Text = text;
        b.SetBounds(x, y, w, h);
        b.FlatStyle = FlatStyle.Flat;
        b.FlatAppearance.BorderSize = 0;
        b.BackColor = back;
        b.ForeColor = Color.White;
        b.Cursor = Cursors.Hand;
        return b;
    }

    void RestoreWindow() { Show(); WindowState = FormWindowState.Normal; tray.Visible = false; Activate(); }

    void OpenGame()
    {
        try { Process.Start(server.LocalUrl); }
        catch (Exception e) { MessageBox.Show("Не удалось открыть браузер: " + e.Message + "\nОткройте адрес вручную: " + server.LocalUrl, Text); }
    }

    void ToggleLan()
    {
        try { server.Start(lanBox.Checked); }
        catch (Exception e) { MessageBox.Show(e.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error); }
        UpdateStatus();
    }

    void UpdateStatus()
    {
        status.Text = "Игра запущена: " + server.LocalUrl +
            (server.Port != GameServer.PreferredPort ? "\nПорт " + GameServer.PreferredPort + " занят — сохранения будут отдельные." : "");
        if (server.Lan)
        {
            List<string> urls = server.LanUrls();
            lanText.Text = urls.Count > 0 ? "На телефоне откройте: " + string.Join("  ", urls.ToArray()) : "Не найден адрес в локальной сети";
        }
        else lanText.Text = "";
    }
}

static class Program
{
    static string FindGameDir()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        foreach (string d in new[] { baseDir, Path.Combine(baseDir, "bizgame"), Path.Combine(baseDir, "..") })
            if (File.Exists(Path.Combine(d, "index.html")) && File.Exists(Path.Combine(d, Path.Combine("js", "main.js"))))
                return Path.GetFullPath(d);
        return null;
    }

    [STAThread]
    static int Main(string[] args)
    {
        string dir = FindGameDir();
        if (dir == null)
        {
            string msg = "Не найдены файлы игры (index.html и папка js) рядом с программой.";
            if (args.Length > 0) Console.Error.WriteLine(msg); else MessageBox.Show(msg, "БизСити 3D", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        GameServer server = new GameServer(dir);

        // --console: только сервер, без окна (для проверки и для Linux/Mono); --day N — длина дня в секундах
        if (Array.IndexOf(args, "--console") >= 0)
        {
            int dayArg = Array.IndexOf(args, "--day");
            if (dayArg >= 0 && dayArg + 1 < args.Length) ServerSettings.WriteDay(dir, Math.Max(5, int.Parse(args[dayArg + 1])));
            server.Start(Array.IndexOf(args, "--lan") >= 0);
            Console.WriteLine("Длина дня: " + ServerSettings.ReadDay(dir) + " сек. (bizgame/settings.json)");
            Console.WriteLine("БизСити 3D: " + server.LocalUrl + "  (Ctrl+C — выход)");
            Thread.Sleep(Timeout.Infinite);
            return 0;
        }

        // второй запуск — просто открываем игру в браузере
        bool fresh;
        Mutex single = new Mutex(true, "BizCity3D-launcher", out fresh);
        if (!fresh)
        {
            try { Process.Start("http://127.0.0.1:" + GameServer.PreferredPort + "/"); } catch { }
            return 0;
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        try { server.Start(false); }
        catch (Exception e) { MessageBox.Show(e.Message, "БизСити 3D", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1; }
        Application.Run(new MainForm(server, dir));
        GC.KeepAlive(single);
        return 0;
    }
}
