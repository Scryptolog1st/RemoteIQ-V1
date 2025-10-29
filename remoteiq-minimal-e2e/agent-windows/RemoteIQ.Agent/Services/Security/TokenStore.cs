using System.Text.Json;
using RemoteIQ.Agent.Util;

namespace RemoteIQ.Agent.Services.Security;

public class TokenStore
{
    private string _dir = default!;
    private string _file = default!;
    private readonly object _lock = new();

    public class TokenData
    {
        public string? AgentId { get; set; }     // keep as string for flexibility
        public string? DeviceId { get; set; }    // keep as string (hostname/guid/row id)
        public string? AgentToken { get; set; }
        public DateTime? RotateAfter { get; set; }
    }

    public TokenStore()
    {
        var baseDir = !Environment.UserInteractive
            ? Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData) // C:\ProgramData
            : Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData); // C:\Users\<you>\AppData\Local

        InitAt(Path.Combine(baseDir, "RemoteIQ"), harden: !Environment.UserInteractive);
    }

    private void InitAt(string targetDir, bool harden)
    {
        _dir = targetDir;
        _file = Path.Combine(_dir, "agent.json");

        Directory.CreateDirectory(_dir);
        if (harden)
        {
            Try(() => AclUtils.HardenDirectory(_dir));
        }
    }

    public TokenData? Load()
    {
        lock (_lock)
        {
            if (!File.Exists(_file)) return null;
            try
            {
                var json = File.ReadAllText(_file);
                return JsonSerializer.Deserialize<TokenData>(json);
            }
            catch
            {
                return null;
            }
        }
    }

    public void Save(TokenData data)
    {
        lock (_lock)
        {
            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });

            if (TryWrite(_file, json, harden: !Environment.UserInteractive)) return;

            if (Environment.UserInteractive)
            {
                var fallbackDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "RemoteIQ");

                if (!string.Equals(_dir, fallbackDir, StringComparison.OrdinalIgnoreCase))
                {
                    InitAt(fallbackDir, harden: false);
                    if (TryWrite(_file, json, harden: false))
                    {
                        Console.WriteLine($"[TokenStore] Saved token to user-local path: {_file}");
                        return;
                    }
                }
            }

            var tempFile = Path.Combine(Path.GetTempPath(), "RemoteIQ.agent.json");
            if (TryWrite(tempFile, json, harden: false))
            {
                _dir = Path.GetDirectoryName(tempFile)!;
                _file = tempFile;
                Console.WriteLine($"[TokenStore] Saved token to TEMP as a fallback: {_file}");
                return;
            }

            throw new UnauthorizedAccessException(
                $"Failed to save token to '{_file}'. Try running PowerShell as Administrator or fix directory ACLs.");
        }
    }

    public void Clear()
    {
        lock (_lock)
        {
            Try(() =>
            {
                if (File.Exists(_file)) File.Delete(_file);
            });
        }
    }

    private static bool TryWrite(string path, string contents, bool harden)
    {
        try
        {
            var dir = Path.GetDirectoryName(path)!;
            Directory.CreateDirectory(dir);
            File.WriteAllText(path, contents);

            if (harden)
            {
                Try(() => AclUtils.HardenFile(path));
            }
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static void Try(Action a)
    {
        try { a(); } catch { /* best effort */ }
    }
}
