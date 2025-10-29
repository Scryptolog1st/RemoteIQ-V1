// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Services/Jobs/CommandRunner.cs
using System.Diagnostics;
using System.Text;

namespace RemoteIQ.Agent.Services.Jobs;

public static class CommandRunner
{
    public static async Task<(int exitCode, string stdout, string stderr)> RunAsync(string command, TimeSpan timeout, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/c " + command,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            WorkingDirectory = Environment.SystemDirectory
        };

        using var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
        var sbOut = new StringBuilder();
        var sbErr = new StringBuilder();
        var tcs = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

        proc.OutputDataReceived += (s, e) => { if (e.Data != null) sbOut.AppendLine(e.Data); };
        proc.ErrorDataReceived += (s, e) => { if (e.Data != null) sbErr.AppendLine(e.Data); };
        proc.Exited += (s, e) => { try { tcs.TrySetResult(proc.ExitCode); } catch { } };

        if (!proc.Start()) throw new InvalidOperationException("Failed to start process");
        proc.BeginOutputReadLine();
        proc.BeginErrorReadLine();

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeout);

        try
        {
            var exit = await tcs.Task.WaitAsync(cts.Token);
            return (exit, sbOut.ToString(), sbErr.ToString());
        }
        catch (OperationCanceledException)
        {
            try { if (!proc.HasExited) proc.Kill(true); } catch { }
            return (-1, sbOut.ToString(), sbErr.ToString());
        }
    }
}
