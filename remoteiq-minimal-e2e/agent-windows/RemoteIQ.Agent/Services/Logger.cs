using System.IO;

namespace RemoteIQ.Agent.Services;

public static class Logger
{
    private static readonly object _lock = new();
    private static readonly string LogDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RemoteIQ");
    private static readonly string LogFile = Path.Combine(LogDir, "agent.log");

    public static void Info(string msg) => Write("INFO", msg);
    public static void Warn(string msg) => Write("WARN", msg);
    public static void Error(string msg) => Write("ERROR", msg);

    private static void Write(string level, string msg)
    {
        lock (_lock)
        {
            Directory.CreateDirectory(LogDir);
            File.AppendAllText(LogFile, $"{DateTime.UtcNow:o} [{level}] {msg}\n");
        }
    }
}