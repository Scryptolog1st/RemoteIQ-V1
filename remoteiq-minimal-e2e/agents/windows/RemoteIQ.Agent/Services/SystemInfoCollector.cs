using System.Management;

namespace RemoteIQ.Agent.Services;

public sealed class SystemInfoCollector
{
    public Dictionary<string, object> Collect()
    {
        var info = new Dictionary<string, object>
        {
            ["hostname"] = Environment.MachineName,
            ["username"] = Environment.UserName,
            ["osVersion"] = Environment.OSVersion.ToString(),
            ["architecture"] = Environment.Is64BitOperatingSystem ? "x64" : "x86",
            ["dotnetRuntime"] = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
        };

        info["hardware"] = new Dictionary<string, object>
        {
            ["cpu"] = WmiMulti("Win32_Processor","Name,NumberOfCores,NumberOfLogicalProcessors"),
            ["memoryBytes"] = Try(() => Convert.ToUInt64(WmiSingle("Win32_ComputerSystem","TotalPhysicalMemory")), 0UL),
            ["disks"] = WmiMulti("Win32_LogicalDisk","DeviceID,FileSystem,Size,FreeSpace")
        };

        info["nics"] = WmiMulti("Win32_NetworkAdapterConfiguration","Description,MACAddress,IPAddress");
        info["software"] = QueryInstalledSoftware();

        return info;
    }

    private static object WmiSingle(string cls, string prop)
    {
        using var searcher = new ManagementObjectSearcher($"SELECT {prop} FROM {cls}");
        foreach (var o in searcher.Get())
        {
            var mo = (ManagementObject)o;
            return mo[prop] ?? "";
        }
        return "";
    }

    private static List<Dictionary<string,object>> WmiMulti(string cls, string propsCsv)
    {
        var props = propsCsv.Split(',').Select(s => s.Trim()).ToArray();
        var list = new List<Dictionary<string, object>>();
        using var searcher = new ManagementObjectSearcher($"SELECT {propsCsv} FROM {cls}");
        foreach (var o in searcher.Get())
        {
            var mo = (ManagementObject)o;
            var row = new Dictionary<string, object>();
            foreach (var p in props)
            {
                var val = mo[p];
                if (val is Array arr) row[p] = string.Join(",", arr.Cast<object>());
                else row[p] = val ?? "";
            }
            list.Add(row);
        }
        return list;
    }

    private static T Try<T>(Func<T> f, T fallback) { try { return f(); } catch { return fallback; } }

    private static List<Dictionary<string, string>> QueryInstalledSoftware()
    {
        var result = new List<Dictionary<string, string>>();
        string[] roots = {
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
        };
        foreach (var root in roots)
        {
            using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(root);
            if (key is null) continue;
            foreach (var sub in key.GetSubKeyNames())
            {
                using var sk = key.OpenSubKey(sub);
                if (sk is null) continue;
                var name = sk.GetValue("DisplayName")?.ToString();
                if (string.IsNullOrWhiteSpace(name)) continue;
                result.Add(new Dictionary<string, string>
                {
                    ["name"] = name!,
                    ["version"] = sk.GetValue("DisplayVersion")?.ToString() ?? "",
                    ["publisher"] = sk.GetValue("Publisher")?.ToString() ?? ""
                });
            }
        }
        return result;
    }
}
