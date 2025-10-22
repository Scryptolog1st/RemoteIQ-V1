using System.Diagnostics;
using System.Text;

namespace RemoteIQ.Agent.Services;

public static class ScriptRunner
{
    /// <summary>
    /// Executes PowerShell scriptText with args/env. Writes script as UTF-8 **with BOM**
    /// so Unicode (em dash, smart quotes) is preserved on Windows PowerShell.
    /// Truncates stdout/stderr to maxOutputBytes (default 1MB).
    /// </summary>
    public static async Task<(int exitCode, string stdout, string stderr, int durationMs, bool timedOut)> RunPowerShellAsync(
        string scriptText,
        IEnumerable<string>? args,
        IDictionary<string, string>? env,
        int timeoutSec,
        int maxOutputBytes = 1_000_000,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var tempPath = Path.Combine(Path.GetTempPath(), $"riq_{Guid.NewGuid():N}.ps1");
        var utf8Bom = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);

        await File.WriteAllTextAsync(tempPath, scriptText ?? string.Empty, utf8Bom, ct);

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{tempPath}\" {BuildArgs(args)}",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            if (env != null)
            {
                foreach (var kv in env)
                    if (!string.IsNullOrWhiteSpace(kv.Key))
                        psi.Environment[kv.Key] = kv.Value ?? string.Empty;
            }

            using var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };

            var stdout = new LimitedBuffer(maxOutputBytes);
            var stderr = new LimitedBuffer(maxOutputBytes);

            proc.OutputDataReceived += (_, e) => { if (e.Data != null) stdout.AppendLine(e.Data); };
            proc.ErrorDataReceived += (_, e) => { if (e.Data != null) stderr.AppendLine(e.Data); };

            proc.Start();
            proc.BeginOutputReadLine();
            proc.BeginErrorReadLine();

            var timeout = TimeSpan.FromSeconds(timeoutSec > 0 ? timeoutSec : 120);
            var exited = await Task.Run(() => proc.WaitForExit((int)timeout.TotalMilliseconds), ct);
            if (!exited)
            {
                TryKill(proc);
                return (124, stdout.ToStringWithTruncationNote(), "timeout", (int)sw.ElapsedMilliseconds, true);
            }

            proc.WaitForExit(); // ensure handlers flush
            return (proc.ExitCode, stdout.ToStringWithTruncationNote(), stderr.ToStringWithTruncationNote(), (int)sw.ElapsedMilliseconds, false);
        }
        finally
        {
            try { File.Delete(tempPath); } catch { /* ignore */ }
        }
    }

    private static string BuildArgs(IEnumerable<string>? args)
        => args == null ? string.Empty : string.Join(" ", args.Select(a => $"\"{a}\""));

    private static void TryKill(Process p)
    {
        try { if (!p.HasExited) p.Kill(entireProcessTree: true); } catch { /* ignore */ }
    }

    private sealed class LimitedBuffer
    {
        private readonly int _limit;
        private readonly MemoryStream _ms;
        private readonly StreamWriter _sw;
        private bool _truncated;

        public LimitedBuffer(int limitBytes)
        {
            _limit = limitBytes;
            _ms = new MemoryStream();
            _sw = new StreamWriter(_ms, new UTF8Encoding(false)) { AutoFlush = true };
        }

        public void AppendLine(string s)
        {
            var data = Encoding.UTF8.GetBytes(s + Environment.NewLine);
            if (_ms.Length + data.Length <= _limit)
            {
                _ms.Write(data, 0, data.Length);
            }
            else
            {
                var remaining = _limit - _ms.Length;
                if (remaining > 0)
                {
                    _ms.Write(data, 0, (int)remaining);
                }
                _truncated = true;
            }
        }

        public string ToStringWithTruncationNote()
        {
            _sw.Flush();
            var text = Encoding.UTF8.GetString(_ms.ToArray());
            return _truncated ? text + Environment.NewLine + "(truncated)" : text;
        }
    }
}
