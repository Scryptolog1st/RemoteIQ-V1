using System.Diagnostics;
using RemoteIQ.Agent.Models;
using System.Management; // <-- ADDED THIS
using System.Linq; // <-- ADDED THIS

namespace RemoteIQ.Agent.Services.Collectors;

public class MetricsCollector
{
    public (double cpuPct, double memPct, Dictionary<string, double> diskPct, List<TopProcess> tops) Sample(int topN = 5)
    {
        double cpu = GetCpuUsagePct();
        double mem = GetMemPct();
        var disk = GetDiskPct();
        var tops = GetTopProcesses(topN);
        return (cpu, mem, disk, tops);
    }

    static double GetCpuUsagePct()
    {
        try
        {
            using var cpu = new PerformanceCounter("Processor", "% Processor Time", "_Total");
            _ = cpu.NextValue();
            Thread.Sleep(500);
            return Math.Round(cpu.NextValue(), 1);
        }
        catch { return 0; }
    }

    // --- THIS METHOD IS UPDATED ---
    static double GetMemPct()
    {
        try
        {
            // Use WMI (System.Management) instead of VisualBasic
            using var searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem");
            using var collection = searcher.Get();
            using var mem = collection.Cast<ManagementObject>().First();

            var totalMemKb = (ulong)mem["TotalVisibleMemorySize"];
            var freeMemKb = (ulong)mem["FreePhysicalMemory"];
            var usedMemKb = totalMemKb - freeMemKb;

            if (totalMemKb == 0) return 0; // Avoid divide by zero

            return Math.Round(100.0 * usedMemKb / totalMemKb, 1);
        }
        catch { return 0; }
    }

    static Dictionary<string, double> GetDiskPct()
    {
        var dict = new Dictionary<string, double>();
        try
        {
            foreach (var di in DriveInfo.GetDrives().Where(d => d.IsReady && d.DriveType == DriveType.Fixed))
            {
                var used = di.TotalSize - di.AvailableFreeSpace;
                var pct = 100.0 * used / Math.Max(1, (double)di.TotalSize);
                dict[di.Name.TrimEnd('\\')] = Math.Round(pct, 1);
            }
        }
        catch { }
        return dict;
    }

    static List<TopProcess> GetTopProcesses(int topN)
    {
        try
        {
            var list = Process.GetProcesses()
                .Select(p =>
                {
                    long mem = 0;
                    try { mem = p.WorkingSet64; } catch { }
                    return new { p.Id, p.ProcessName, Mem = mem };
                })
                .OrderByDescending(x => x.Mem)
                .Take(topN)
                .Select(x => new TopProcess(x.Id, x.ProcessName + ".exe", 0, x.Mem))
                .ToList();
            return list;
        }
        catch { return new List<TopProcess>(); }
    }
}