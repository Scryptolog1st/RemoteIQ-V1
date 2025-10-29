// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Models/Fingerprint.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Management;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace RemoteIQ.Agent.Models
{
    /// <summary>
    /// Builds a stable machine fingerprint and basic platform facts
    /// without referencing OsInfo/AgentInfo.
    /// </summary>
    public static class Fingerprint
    {
        /// <summary>
        /// Returns (deviceId, hostname, os, arch).
        /// os:   "windows" | "linux" | "macos" (we hardcode "windows" here)
        /// arch: "x64" | "arm64" | "x86"
        /// </summary>
        public static (string deviceId, string hostname, string os, string arch) Build()
        {
            string hostname = Environment.MachineName;
            string os = "windows";
            string arch = MapArch(RuntimeInformation.ProcessArchitecture);

            var parts = new List<string>
            {
                hostname,
                GetBiosSerial(),
                string.Join(",", GetMacs())
            };

            var raw = string.Join("|", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
            using var sha = SHA256.Create();
            var deviceId = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();

            return (deviceId, hostname, os, arch);
        }

        private static string GetBiosSerial()
        {
            try
            {
                using var mos = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS");
                foreach (ManagementObject mo in mos.Get())
                    return mo["SerialNumber"]?.ToString() ?? "";
            }
            catch { }
            return "";
        }

        private static IEnumerable<string> GetMacs()
        {
            try
            {
                return NetworkInterface.GetAllNetworkInterfaces()
                    .Where(n => n.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                                n.OperationalStatus == OperationalStatus.Up)
                    .Select(n => n.GetPhysicalAddress()?.ToString())
                    .Where(s => !string.IsNullOrWhiteSpace(s))!;
            }
            catch
            {
                return Array.Empty<string>();
            }
        }

        private static string MapArch(Architecture arch) => arch switch
        {
            Architecture.X64 => "x64",
            Architecture.Arm64 => "arm64",
            Architecture.X86 => "x86",
            _ => "x64"
        };
    }
}
