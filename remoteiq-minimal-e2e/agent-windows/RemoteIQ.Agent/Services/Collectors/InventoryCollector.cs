// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Services/Collectors/InventoryCollector.cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Management;
using RemoteIQ.Agent.Models;

namespace RemoteIQ.Agent.Services.Collectors
{
    public class InventoryCollector
    {
        public (Hardware hw, Network net, List<SoftwareItem> sw, List<ServiceItem> svcs, List<ProcessItem> procs) Collect(int topN = 5)
        {
            var hw = GetHardware();
            var net = GetNetwork();
            var sw = GetSoftware();
            var svcs = GetServices();
            var procs = GetProcesses(topN);
            return (hw, net, sw, svcs, procs);
        }

        static Hardware GetHardware()
        {
            var cpu = new Cpu(GetCpuName(), GetCoreCount(), Environment.ProcessorCount);
            long ram = GetTotalRam();
            var disks = GetDisks();
            var gpus = GetGpus();
            var mobo = GetMotherboard();
            var bios = GetBios();
            return new Hardware(cpu, ram, disks, gpus, mobo, bios);
        }

        static string GetCpuName()
        {
            try
            {
                using var mos = new ManagementObjectSearcher("select Name from Win32_Processor");
                foreach (ManagementObject mo in mos.Get()) return mo["Name"]?.ToString() ?? "";
            }
            catch { }
            return "";
        }

        static int GetCoreCount()
        {
            try
            {
                using var mos = new ManagementObjectSearcher("select NumberOfCores from Win32_Processor");
                foreach (ManagementObject mo in mos.Get()) return Convert.ToInt32(mo["NumberOfCores"] ?? 0);
            }
            catch { }
            return Environment.ProcessorCount;
        }

        static long GetTotalRam()
        {
            try
            {
                using var mos = new ManagementObjectSearcher("select TotalVisibleMemorySize from Win32_OperatingSystem");
                foreach (ManagementObject mo in mos.Get())
                {
                    var kb = Convert.ToInt64(mo["TotalVisibleMemorySize"] ?? 0);
                    return kb * 1024;
                }
            }
            catch { }
            return 0;
        }

        static List<Disk> GetDisks()
        {
            var list = new List<Disk>();
            try
            {
                using var mos = new ManagementObjectSearcher("select Name,Size,MediaType from Win32_DiskDrive");
                foreach (ManagementObject mo in mos.Get())
                {
                    var name = mo["Name"]?.ToString() ?? "";
                    var size = Convert.ToInt64(mo["Size"] ?? 0);
                    var type = mo["MediaType"]?.ToString() ?? "";
                    list.Add(new Disk(name, size, type));
                }
            }
            catch { }
            return list;
        }

        static List<Gpu> GetGpus()
        {
            var list = new List<Gpu>();
            try
            {
                using var mos = new ManagementObjectSearcher("select Name,DriverVersion from Win32_VideoController");
                foreach (ManagementObject mo in mos.Get())
                    list.Add(new Gpu(mo["Name"]?.ToString() ?? "", mo["DriverVersion"]?.ToString()));
            }
            catch { }
            return list;
        }

        static Motherboard GetMotherboard()
        {
            try
            {
                using var mos = new ManagementObjectSearcher("select Manufacturer,Product from Win32_BaseBoard");
                foreach (ManagementObject mo in mos.Get())
                    return new Motherboard(mo["Manufacturer"]?.ToString() ?? "", mo["Product"]?.ToString() ?? "");
            }
            catch { }
            return new Motherboard("", "");
        }

        static Bios GetBios()
        {
            try
            {
                using var mos = new ManagementObjectSearcher("select Manufacturer,SMBIOSBIOSVersion,ReleaseDate from Win32_BIOS");
                foreach (ManagementObject mo in mos.Get())
                    return new Bios(mo["Manufacturer"]?.ToString() ?? "", mo["SMBIOSBIOSVersion"]?.ToString() ?? "", mo["ReleaseDate"]?.ToString());
            }
            catch { }
            return new Bios("", "", null);
        }

        static Network GetNetwork()
        {
            var list = new List<NetIf>();
            try
            {
                using var mos = new ManagementObjectSearcher(
                    "select Description,MACAddress,IPEnabled,IPAddress,DefaultIPGateway,DNSServerSearchOrder from Win32_NetworkAdapterConfiguration where IPEnabled = true");
                foreach (ManagementObject mo in mos.Get())
                {
                    var name = mo["Description"]?.ToString() ?? "Adapter";
                    var mac = mo["MACAddress"]?.ToString() ?? "";

                    var ips = mo["IPAddress"] as string[] ?? Array.Empty<string>();
                    var ipv4 = ips.Where(ip => ip != null && ip.Contains('.')).ToList();
                    var ipv6 = ips.Where(ip => ip != null && ip.Contains(':')).ToList();

                    var gw = (mo["DefaultIPGateway"] as string[] ?? Array.Empty<string>()).FirstOrDefault();
                    var dns = (mo["DNSServerSearchOrder"] as string[] ?? Array.Empty<string>()).ToList();

                    list.Add(new NetIf(name, mac, ipv4, ipv6, gw, dns));
                }
            }
            catch { }
            return new Network(list);
        }

        static List<SoftwareItem> GetSoftware()
        {
            var list = new List<SoftwareItem>();
            try
            {
                var roots = new[] {
                    Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
                    Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall")
                };
                foreach (var root in roots.Where(r => r != null)!)
                {
                    foreach (var keyName in root!.GetSubKeyNames())
                    {
                        using var k = root.OpenSubKey(keyName);
                        var name = k?.GetValue("DisplayName")?.ToString();
                        if (string.IsNullOrWhiteSpace(name)) continue;
                        var ver = k?.GetValue("DisplayVersion")?.ToString();
                        var pub = k?.GetValue("Publisher")?.ToString();
                        var dt = k?.GetValue("InstallDate")?.ToString();
                        list.Add(new SoftwareItem(name!, ver, pub, dt));
                    }
                }
            }
            catch { }
            return list;
        }

        static List<ServiceItem> GetServices()
        {
            var list = new List<ServiceItem>();
            try
            {
                foreach (var sc in System.ServiceProcess.ServiceController.GetServices())
                {
                    string startType = "Unknown";
                    try
                    {
                        using var mos = new ManagementObjectSearcher(
                            $"select StartMode,DisplayName,Name from Win32_Service where Name='{sc.ServiceName.Replace("'", "''")}'");
                        foreach (ManagementObject mo in mos.Get())
                            startType = mo["StartMode"]?.ToString() ?? "Unknown";
                    }
                    catch { }
                    list.Add(new ServiceItem(sc.ServiceName, sc.DisplayName, sc.Status.ToString(), startType));
                }
            }
            catch { }
            return list;
        }

        static List<ProcessItem> GetProcesses(int topN)
        {
            var list = new List<ProcessItem>();
            try
            {
                foreach (var p in System.Diagnostics.Process.GetProcesses())
                {
                    long mem = 0;
                    try { mem = p.WorkingSet64; } catch { }
                    list.Add(new ProcessItem(p.Id, p.ProcessName + ".exe", 0, mem));
                }
                // Keep more than topN so server can choose what to display
                list = list.OrderByDescending(x => x.MemBytes).Take(Math.Max(10, topN * 3)).ToList();
            }
            catch { }
            return list;
        }
    }
}
