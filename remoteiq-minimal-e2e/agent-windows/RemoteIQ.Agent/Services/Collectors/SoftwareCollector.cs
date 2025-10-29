//remoteiq-minimal-e2e\agent-windows\RemoteIQ.Agent\Services\Collectors\SoftwareCollector.cs

using Microsoft.Win32;
using RemoteIQ.Agent.Models;
using System;
using System.Collections.Generic;

namespace RemoteIQ.Agent.Services.Collectors
{
    public static class SoftwareCollector
    {
        public static List<InstalledApp> Collect()
        {
            var list = new List<InstalledApp>();
            try
            {
                ReadUninstall(RegistryHive.LocalMachine, RegistryView.Registry64, list);
                ReadUninstall(RegistryHive.LocalMachine, RegistryView.Registry32, list);
            }
            catch { /* ignore */ }

            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var dedup = new List<InstalledApp>();
            foreach (var s in list)
            {
                if (string.IsNullOrWhiteSpace(s.DisplayName)) continue;
                var key = $"{s.DisplayName}|{s.Version}";
                if (seen.Add(key)) dedup.Add(s);
            }
            return dedup;
        }

        private static void ReadUninstall(RegistryHive hive, RegistryView view, List<InstalledApp> output)
        {
            using var baseKey = RegistryKey.OpenBaseKey(hive, view);
            using var uninstall = baseKey.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
            if (uninstall == null) return;

            foreach (var sub in uninstall.GetSubKeyNames())
            {
                using var k = uninstall.OpenSubKey(sub);
                if (k == null) continue;

                var name = (k.GetValue("DisplayName") as string)?.Trim();
                if (string.IsNullOrWhiteSpace(name)) continue;

                var version = (k.GetValue("DisplayVersion") as string)?.Trim();
                var publisher = (k.GetValue("Publisher") as string)?.Trim();

                string? installDate = (k.GetValue("InstallDate") as string)?.Trim();
                installDate = NormalizeInstallDate(installDate);

                output.Add(new InstalledApp(
                    DisplayName: name,
                    Version: string.IsNullOrWhiteSpace(version) ? null : version,
                    Publisher: string.IsNullOrWhiteSpace(publisher) ? null : publisher,
                    InstallDate: string.IsNullOrWhiteSpace(installDate) ? null : installDate
                ));
            }
        }

        private static string? NormalizeInstallDate(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;

            if (raw.Length == 8 && int.TryParse(raw, out _))
                return $"{raw[..4]}-{raw.Substring(4, 2)}-{raw.Substring(6, 2)}";

            if (DateTime.TryParse(raw, out var dt))
                return dt.ToString("yyyy-MM-dd");

            return null;
        }
    }
}
