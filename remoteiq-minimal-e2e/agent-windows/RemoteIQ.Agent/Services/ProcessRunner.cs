using System.Diagnostics;
using System.Text;

namespace RemoteIQ.Agent.Services;

public static class ProcessRunner
{
    public sealed record Result(int ExitCode, string Stdout, string Stderr, int DurationMs);

    public static async Task<Result> RunPowerShellAsync(
        string scriptText, string[] args, IDictionary<string, string> env, int timeoutSec, CancellationToken ct)
    {
        // Write script to a temp file (ASCII-safe)
        var scriptPath = Path.Combine(Path.GetTempPath(), $"riq_{Guid.NewGuid():N}.ps1");
        await File.WriteAllTextAsync(scriptPath, scriptText, new UTF8Encoding(false), ct);

        try
        {
            // Build args
            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = BuildPsArgs(scriptPath, args),
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            // Inject env
            foreach (var kv in env)
                psi.Environment[kv.Key] = kv.Value;

            var sw = Stopwatch.StartNew();
            using var proc = new Process { StartInfo = psi };
            var stdout = new StringBuilder();
            var stderr = new StringBuilder();

            var tcsOut = new TaskCompletionSource<object?>();
            var tcsErr = new TaskCompletionSource<object?>();

            proc.OutputDataReceived += (_, e) =>
            {
                if (e.Data is null) tcsOut.TrySetResult(null);
                else stdout.AppendLine(e.Data);
            };
            proc.ErrorDataReceived += (_, e) =>
            {
                if (e.Data is null) tcsErr.TrySetResult(null);
                else stderr.AppendLine(e.Data);
            };

            proc.Start();
            proc.BeginOutputReadLine();
            proc.BeginErrorReadLine();

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, timeoutSec)));

            try
            {
                await Task.WhenAny(Task.Run(() => proc.WaitForExit(), timeoutCts.Token), Task.Delay(-1, timeoutCts.Token));
            }
            catch (OperationCanceledException) { /* timeout or external cancel */ }

            if (!proc.HasExited)
            {
                try { proc.Kill(entireProcessTree: true); } catch { }
                return new Result(-1, stdout.ToString(), "Timeout", (int)sw.ElapsedMilliseconds);
            }

            // ensure async readers finished
            await Task.WhenAll(tcsOut.Task.TaskOrCompleted(), tcsErr.Task.TaskOrCompleted());
            return new Result(proc.ExitCode, stdout.ToString(), stderr.ToString(), (int)sw.ElapsedMilliseconds);
        }
        finally
        {
            try { File.Delete(scriptPath); } catch { }
        }
    }

    private static string BuildPsArgs(string scriptPath, string[] args)
    {
        // -NoLogo -NoProfile -ExecutionPolicy Bypass -File "<script>" [args...]
        var quoted = args.Select(a => $"\"{a.Replace("\"", "\\\"")}\"");
        return $"-NoLogo -NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\" {string.Join(' ', quoted)}";
    }

    private static Task TaskOrCompleted(this Task t) => t.IsCompleted ? Task.CompletedTask : t;
}
