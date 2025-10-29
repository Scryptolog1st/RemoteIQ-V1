// Util/AclUtils.cs
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Runtime.Versioning;

namespace RemoteIQ.Agent.Util;

[SupportedOSPlatform("windows")]
public static class AclUtils
{
    [SupportedOSPlatform("windows")]
    public static void HardenDirectory(string path)
    {
        if (!OperatingSystem.IsWindows()) return; // belt & suspenders
        try
        {
            var dirInfo = new DirectoryInfo(path);
            var sec = dirInfo.GetAccessControl();
            sec.SetAccessRuleProtection(true, false);

            var systemSid = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            var adminsSid = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);

            foreach (FileSystemAccessRule r in sec.GetAccessRules(true, true, typeof(SecurityIdentifier)))
                sec.RemoveAccessRule(r);

            sec.AddAccessRule(new FileSystemAccessRule(systemSid, FileSystemRights.FullControl, AccessControlType.Allow));
            sec.AddAccessRule(new FileSystemAccessRule(adminsSid, FileSystemRights.FullControl, AccessControlType.Allow));
            dirInfo.SetAccessControl(sec);
        }
        catch { }
    }

    [SupportedOSPlatform("windows")]
    public static void HardenFile(string path)
    {
        if (!OperatingSystem.IsWindows()) return;
        try
        {
            var fi = new FileInfo(path);
            var sec = fi.GetAccessControl();
            sec.SetAccessRuleProtection(true, false);

            var systemSid = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            var adminsSid = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);

            foreach (FileSystemAccessRule r in sec.GetAccessRules(true, true, typeof(SecurityIdentifier)))
                sec.RemoveAccessRule(r);

            sec.AddAccessRule(new FileSystemAccessRule(systemSid, FileSystemRights.FullControl, AccessControlType.Allow));
            sec.AddAccessRule(new FileSystemAccessRule(adminsSid, FileSystemRights.FullControl, AccessControlType.Allow));
            fi.SetAccessControl(sec);
        }
        catch { }
    }
}
