$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
[Console]::Error.SetOut([System.IO.TextWriter]::Null)

$script:MaximumInputCharacters = 8192
$script:MaximumDescendantEntries = 100000

function Write-StableFailure {
    [Console]::Out.WriteLine('{"code":"BACKUP_PATH_UNSAFE"}')
}

function Read-BoundedStandardInput {
    $builder = New-Object System.Text.StringBuilder
    $buffer = New-Object 'char[]' 1024

    while ($true) {
        $remaining = $script:MaximumInputCharacters - $builder.Length
        if ($remaining -lt 0) {
            throw 'input-bound'
        }

        $requested = [Math]::Min($buffer.Length, $remaining + 1)
        $count = [Console]::In.Read($buffer, 0, $requested)
        if ($count -eq 0) {
            break
        }
        if (($builder.Length + $count) -gt $script:MaximumInputCharacters) {
            throw 'input-bound'
        }
        [void]$builder.Append($buffer, 0, $count)
    }

    return $builder.ToString()
}

function Assert-ExactProperties {
    param(
        [Parameter(Mandatory = $true)] $Value,
        [Parameter(Mandatory = $true)] [string[]] $Allowed,
        [Parameter(Mandatory = $true)] [string[]] $Required
    )

    if ($null -eq $Value -or $Value -is [System.Array]) {
        throw 'schema'
    }

    $propertyNames = @($Value.PSObject.Properties | ForEach-Object { $_.Name })
    foreach ($propertyName in $propertyNames) {
        if ($Allowed -cnotcontains $propertyName) {
            throw 'schema'
        }
    }
    foreach ($requiredName in $Required) {
        if ($propertyNames -cnotcontains $requiredName) {
            throw 'schema'
        }
    }
}

function Assert-HexIdentity {
    param(
        [Parameter(Mandatory = $true)] [string] $Value,
        [Parameter(Mandatory = $true)] [int] $Length
    )

    if ($Value.Length -ne $Length -or $Value -notmatch ('\A[0-9A-Fa-f]{' + $Length + '}\z')) {
        throw 'identity'
    }
    return $Value.ToUpperInvariant()
}

function Get-LocalCoordinate {
    param([Parameter(Mandatory = $true)] [string] $Path)

    if ([string]::IsNullOrWhiteSpace($Path) -or $Path.Length -gt 4096) {
        throw 'coordinate'
    }
    if ($Path -notmatch '\A[A-Za-z]:[\\/]' -or $Path.Substring(2).Contains(':')) {
        throw 'coordinate'
    }

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $volumeRoot = [System.IO.Path]::GetPathRoot($fullPath)
    if ([string]::IsNullOrWhiteSpace($volumeRoot) -or $volumeRoot.StartsWith('\\')) {
        throw 'coordinate'
    }

    $trimmedFull = $fullPath.TrimEnd([char[]]@('\', '/'))
    $trimmedRoot = $volumeRoot.TrimEnd([char[]]@('\', '/'))
    if ([string]::Equals($trimmedFull, $trimmedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        $fullPath = $volumeRoot
    } else {
        $fullPath = $trimmedFull
    }

    return [PSCustomObject]@{
        FullPath = $fullPath
        VolumeRoot = $volumeRoot
    }
}

function Get-AncestorCoordinates {
    param(
        [Parameter(Mandatory = $true)] [string] $FullPath,
        [Parameter(Mandatory = $true)] [string] $VolumeRoot
    )

    $coordinates = New-Object System.Collections.Generic.List[string]
    $current = $FullPath
    $rootComparison = $VolumeRoot.TrimEnd([char[]]@('\', '/'))

    while ($true) {
        $coordinates.Add($current)
        $currentComparison = $current.TrimEnd([char[]]@('\', '/'))
        if ([string]::Equals($currentComparison, $rootComparison, [System.StringComparison]::OrdinalIgnoreCase)) {
            break
        }

        $parent = [System.IO.Directory]::GetParent($current)
        if ($null -eq $parent) {
            throw 'ancestor'
        }
        $current = $parent.FullName
    }

    return $coordinates
}

function Get-TreeSnapshot {
    param(
        [Parameter(Mandatory = $true)] [string] $FullPath,
        [Parameter(Mandatory = $true)] [string] $VolumeRoot
    )

    $entries = New-Object System.Collections.Generic.List[object]
    $pinnedVolume = $null
    foreach ($ancestor in (Get-AncestorCoordinates -FullPath $FullPath -VolumeRoot $VolumeRoot)) {
        $result = [NumberDroidWindowsRootProbe]::InspectDirectory($ancestor)
        if ($result.FileSystem -cne 'NTFS' -or $result.CaseSensitive -or $null -ne $result.ReparseTag) {
            throw 'filesystem'
        }
        if ($null -eq $pinnedVolume) {
            $pinnedVolume = $result.VolumeSerial
        } elseif ($result.VolumeSerial -cne $pinnedVolume) {
            throw 'identity'
        }
        $entries.Add($result)
    }

    if ($entries.Count -eq 0) {
        throw 'identity'
    }
    return ,$entries
}

function Assert-StableSnapshots {
    param(
        [Parameter(Mandatory = $true)] $First,
        [Parameter(Mandatory = $true)] $Second
    )

    if ($First.Count -ne $Second.Count) {
        throw 'identity'
    }
    for ($index = 0; $index -lt $First.Count; $index++) {
        if ($First[$index].VolumeSerial -cne $Second[$index].VolumeSerial -or
            $First[$index].FileId -cne $Second[$index].FileId) {
            throw 'identity'
        }
    }
}

function Assert-SafeDescendants {
    param(
        [Parameter(Mandatory = $true)] [string] $RootPath,
        [Parameter(Mandatory = $true)] [string] $ExpectedVolume
    )

    $pending = New-Object System.Collections.Generic.Stack[string]
    $pending.Push($RootPath)
    $entryCount = 0
    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()
        foreach ($entryPath in [System.IO.Directory]::EnumerateFileSystemEntries($directory)) {
            $entryCount++
            if ($entryCount -gt $script:MaximumDescendantEntries) {
                throw 'descendant-bound'
            }
            $entry = [NumberDroidWindowsRootProbe]::InspectEntry($entryPath)
            if ($entry.FileSystem -cne 'NTFS' -or $entry.CaseSensitive -or
                $null -ne $entry.ReparseTag -or $entry.VolumeSerial -cne $ExpectedVolume) {
                throw 'filesystem'
            }
            if ($entry.IsDirectory) {
                $pending.Push($entryPath)
            }
        }
    }
}

try {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class NumberDroidWindowsRootProbe
{
    private const uint FILE_READ_ATTRIBUTES = 0x00000080;
    private const uint FILE_SHARE_READ = 0x00000001;
    private const uint FILE_SHARE_WRITE = 0x00000002;
    private const uint FILE_SHARE_DELETE = 0x00000004;
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    private const uint FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000;
    private const uint FILE_ATTRIBUTE_DIRECTORY = 0x00000010;
    private const uint FILE_ATTRIBUTE_REPARSE_POINT = 0x00000400;
    private const uint FILE_CS_FLAG_CASE_SENSITIVE_DIR = 0x00000001;
    private const uint DRIVE_FIXED = 3;

    private enum FILE_INFO_BY_HANDLE_CLASS
    {
        FileAttributeTagInfo = 9,
        FileIdInfo = 18,
        FileCaseSensitiveInfo = 23
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FILE_ATTRIBUTE_TAG_INFO
    {
        internal uint FileAttributes;
        internal uint ReparseTag;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FILE_ID_128
    {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        internal byte[] Identifier;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FILE_ID_INFO
    {
        internal ulong VolumeSerialNumber;
        internal FILE_ID_128 FileId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FILE_CASE_SENSITIVE_INFO
    {
        internal uint Flags;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(
        string fileName,
        uint desiredAccess,
        uint shareMode,
        IntPtr securityAttributes,
        uint creationDisposition,
        uint flagsAndAttributes,
        IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandleEx(
        SafeFileHandle file,
        FILE_INFO_BY_HANDLE_CLASS infoClass,
        IntPtr information,
        uint bufferSize);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetVolumeInformationByHandleW(
        SafeFileHandle file,
        StringBuilder volumeName,
        uint volumeNameSize,
        out uint volumeSerialNumber,
        out uint maximumComponentLength,
        out uint fileSystemFlags,
        StringBuilder fileSystemName,
        uint fileSystemNameSize);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern uint GetDriveTypeW(string rootPathName);

    private static T ReadInformation<T>(SafeFileHandle handle, FILE_INFO_BY_HANDLE_CLASS infoClass)
        where T : struct
    {
        int size = Marshal.SizeOf(typeof(T));
        IntPtr buffer = Marshal.AllocHGlobal(size);
        try
        {
            for (int index = 0; index < size; index++)
            {
                Marshal.WriteByte(buffer, index, 0);
            }
            if (!GetFileInformationByHandleEx(handle, infoClass, buffer, (uint)size))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            return (T)Marshal.PtrToStructure(buffer, typeof(T));
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }

    public sealed class Result
    {
        public bool IsDirectory;
        public string FileSystem;
        public bool CaseSensitive;
        public string VolumeSerial;
        public string FileId;
        public string ReparseTag;
    }

    public static bool IsFixedDrive(string volumeRoot)
    {
        return GetDriveTypeW(volumeRoot) == DRIVE_FIXED;
    }

    public static Result InspectDirectory(string path)
    {
        Result result = InspectEntry(path);
        if (!result.IsDirectory)
        {
            throw new InvalidOperationException();
        }
        return result;
    }

    public static Result InspectEntry(string path)
    {
        using (SafeFileHandle handle = CreateFileW(
            path,
            FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            IntPtr.Zero,
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            IntPtr.Zero))
        {
            if (handle.IsInvalid)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }

            FILE_ATTRIBUTE_TAG_INFO attributes = ReadInformation<FILE_ATTRIBUTE_TAG_INFO>(
                handle, FILE_INFO_BY_HANDLE_CLASS.FileAttributeTagInfo);
            bool isDirectory = (attributes.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
            if ((attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
            {
                throw new InvalidOperationException();
            }

            FILE_ID_INFO identity = ReadInformation<FILE_ID_INFO>(
                handle, FILE_INFO_BY_HANDLE_CLASS.FileIdInfo);
            bool caseSensitive = false;
            if (isDirectory)
            {
                FILE_CASE_SENSITIVE_INFO caseInfo = ReadInformation<FILE_CASE_SENSITIVE_INFO>(
                    handle, FILE_INFO_BY_HANDLE_CLASS.FileCaseSensitiveInfo);
                caseSensitive = (caseInfo.Flags & FILE_CS_FLAG_CASE_SENSITIVE_DIR) != 0;
            }
            if (identity.FileId.Identifier == null || identity.FileId.Identifier.Length != 16)
            {
                throw new InvalidOperationException();
            }

            StringBuilder volumeName = new StringBuilder(261);
            StringBuilder fileSystemName = new StringBuilder(32);
            uint ignoredSerial;
            uint ignoredMaximumComponentLength;
            uint ignoredFileSystemFlags;
            if (!GetVolumeInformationByHandleW(
                handle,
                volumeName,
                (uint)volumeName.Capacity,
                out ignoredSerial,
                out ignoredMaximumComponentLength,
                out ignoredFileSystemFlags,
                fileSystemName,
                (uint)fileSystemName.Capacity))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }

            return new Result
            {
                IsDirectory = isDirectory,
                FileSystem = fileSystemName.ToString(),
                CaseSensitive = caseSensitive,
                VolumeSerial = identity.VolumeSerialNumber.ToString("X16"),
                FileId = BitConverter.ToString(identity.FileId.Identifier).Replace("-", ""),
                ReparseTag = attributes.ReparseTag == 0 ? null : attributes.ReparseTag.ToString("X8")
            };
        }
    }
}
'@

    $rawInput = Read-BoundedStandardInput
    if ([string]::IsNullOrWhiteSpace($rawInput)) {
        throw 'schema'
    }

    $request = $rawInput | ConvertFrom-Json
    Assert-ExactProperties -Value $request -Allowed @('path', 'inspectDescendants', 'expectedVolumeSerial', 'expectedFileId') -Required @('path')
    if ($request.path -isnot [string]) {
        throw 'schema'
    }

    $hasExpectedVolume = $null -ne $request.PSObject.Properties['expectedVolumeSerial']
    $hasExpectedFile = $null -ne $request.PSObject.Properties['expectedFileId']
    if ($hasExpectedVolume -ne $hasExpectedFile) {
        throw 'schema'
    }

    $expectedVolume = $null
    $expectedFile = $null
    $inspectDescendants = $false
    if ($null -ne $request.PSObject.Properties['inspectDescendants']) {
        if ($request.inspectDescendants -isnot [bool]) {
            throw 'schema'
        }
        $inspectDescendants = $request.inspectDescendants
    }
    if ($hasExpectedVolume) {
        if ($request.expectedVolumeSerial -isnot [string] -or $request.expectedFileId -isnot [string]) {
            throw 'schema'
        }
        $expectedVolume = Assert-HexIdentity -Value $request.expectedVolumeSerial -Length 16
        $expectedFile = Assert-HexIdentity -Value $request.expectedFileId -Length 32
    }

    $coordinate = Get-LocalCoordinate -Path $request.path
    if (-not [NumberDroidWindowsRootProbe]::IsFixedDrive($coordinate.VolumeRoot)) {
        throw 'filesystem'
    }

    $firstSnapshot = Get-TreeSnapshot -FullPath $coordinate.FullPath -VolumeRoot $coordinate.VolumeRoot
    $secondSnapshot = Get-TreeSnapshot -FullPath $coordinate.FullPath -VolumeRoot $coordinate.VolumeRoot
    Assert-StableSnapshots -First $firstSnapshot -Second $secondSnapshot
    $targetResult = $secondSnapshot[0]
    if ($null -ne $expectedVolume -and
        ($targetResult.VolumeSerial -cne $expectedVolume -or $targetResult.FileId -cne $expectedFile)) {
        throw 'identity'
    }
    if ($inspectDescendants) {
        Assert-SafeDescendants -RootPath $coordinate.FullPath -ExpectedVolume $targetResult.VolumeSerial
    }

    [Console]::Out.WriteLine(
        '{"code":"OK","filesystem":"NTFS","caseSensitive":false,"volumeSerial":"' +
        $targetResult.VolumeSerial + '","fileId":"' + $targetResult.FileId +
        '","reparseTag":null}')
} catch {
    Write-StableFailure
}
