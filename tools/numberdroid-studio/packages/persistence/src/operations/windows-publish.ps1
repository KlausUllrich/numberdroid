$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
[Console]::Error.SetOut([System.IO.TextWriter]::Null)

$script:MaximumInputCharacters = 16384
$script:Published = $false

function Write-StableCode {
    param([Parameter(Mandatory = $true)] [string] $Code)
    [Console]::Out.WriteLine('{"code":"' + $Code + '"}')
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

function Inspect-Tree {
    param(
        [Parameter(Mandatory = $true)] [string] $FullPath,
        [Parameter(Mandatory = $true)] [string] $ConfiguredRootPath,
        [Parameter(Mandatory = $true)] [string] $VolumeRoot
    )

    $targetResult = $null
    $rootResult = $null
    $pinnedVolume = $null
    $entries = New-Object System.Collections.Generic.List[object]
    $rootComparison = $ConfiguredRootPath.TrimEnd([char[]]@('\', '/'))

    foreach ($ancestor in (Get-AncestorCoordinates -FullPath $FullPath -VolumeRoot $VolumeRoot)) {
        $result = [NumberDroidWindowsPublisher]::InspectDirectory($ancestor)
        if ($result.FileSystem -cne 'NTFS' -or $result.CaseSensitive -or $null -ne $result.ReparseTag) {
            throw 'filesystem'
        }
        if ($null -eq $pinnedVolume) {
            $pinnedVolume = $result.VolumeSerial
            $targetResult = $result
        } elseif ($result.VolumeSerial -cne $pinnedVolume) {
            throw 'identity'
        }

        $ancestorComparison = $ancestor.TrimEnd([char[]]@('\', '/'))
        if ([string]::Equals($ancestorComparison, $rootComparison, [System.StringComparison]::OrdinalIgnoreCase)) {
            $rootResult = $result
        }
        $entries.Add($result)
    }

    if ($null -eq $targetResult -or $null -eq $rootResult) {
        throw 'identity'
    }
    return [PSCustomObject]@{ Target = $targetResult; Root = $rootResult; Entries = $entries }
}

function Assert-StableProofs {
    param(
        [Parameter(Mandatory = $true)] $First,
        [Parameter(Mandatory = $true)] $Second
    )

    if ($First.Entries.Count -ne $Second.Entries.Count) {
        throw 'identity'
    }
    for ($index = 0; $index -lt $First.Entries.Count; $index++) {
        if ($First.Entries[$index].VolumeSerial -cne $Second.Entries[$index].VolumeSerial -or
            $First.Entries[$index].FileId -cne $Second.Entries[$index].FileId) {
            throw 'identity'
        }
    }
}

function Assert-Identity {
    param(
        [Parameter(Mandatory = $true)] $Actual,
        [Parameter(Mandatory = $true)] [string] $ExpectedVolume,
        [Parameter(Mandatory = $true)] [string] $ExpectedFile
    )

    if ($Actual.VolumeSerial -cne $ExpectedVolume -or $Actual.FileId -cne $ExpectedFile) {
        throw 'identity'
    }
}

try {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class NumberDroidWindowsPublisher
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
    private const uint MOVEFILE_WRITE_THROUGH = 0x00000008;
    private const uint DRIVE_FIXED = 3;
    private const int ERROR_FILE_NOT_FOUND = 2;
    private const int ERROR_PATH_NOT_FOUND = 3;
    private const int ERROR_FILE_EXISTS = 80;
    private const int ERROR_ALREADY_EXISTS = 183;

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

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool MoveFileExW(string existingName, string newName, uint flags);

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
            if ((attributes.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) == 0)
            {
                throw new InvalidOperationException();
            }
            if ((attributes.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
            {
                throw new InvalidOperationException();
            }

            FILE_ID_INFO identity = ReadInformation<FILE_ID_INFO>(
                handle, FILE_INFO_BY_HANDLE_CLASS.FileIdInfo);
            FILE_CASE_SENSITIVE_INFO caseInfo = ReadInformation<FILE_CASE_SENSITIVE_INFO>(
                handle, FILE_INFO_BY_HANDLE_CLASS.FileCaseSensitiveInfo);
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
                FileSystem = fileSystemName.ToString(),
                CaseSensitive = (caseInfo.Flags & FILE_CS_FLAG_CASE_SENSITIVE_DIR) != 0,
                VolumeSerial = identity.VolumeSerialNumber.ToString("X16"),
                FileId = BitConverter.ToString(identity.FileId.Identifier).Replace("-", ""),
                ReparseTag = attributes.ReparseTag == 0 ? null : attributes.ReparseTag.ToString("X8")
            };
        }
    }

    public static int CoordinateState(string path)
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
            if (!handle.IsInvalid)
            {
                return 1;
            }
            int error = Marshal.GetLastWin32Error();
            if (error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND)
            {
                return 0;
            }
            return -1;
        }
    }

    public static int Publish(string stagePath, string finalPath)
    {
        if (MoveFileExW(stagePath, finalPath, MOVEFILE_WRITE_THROUGH))
        {
            return 0;
        }
        int error = Marshal.GetLastWin32Error();
        if (error == ERROR_FILE_EXISTS || error == ERROR_ALREADY_EXISTS)
        {
            return 1;
        }
        return -1;
    }
}
'@

    $rawInput = Read-BoundedStandardInput
    if ([string]::IsNullOrWhiteSpace($rawInput)) {
        throw 'schema'
    }

    $request = $rawInput | ConvertFrom-Json
    $requiredProperties = @(
        'rootPath',
        'stagePath',
        'finalPath',
        'expectedRootVolumeSerial',
        'expectedRootFileId',
        'expectedStageVolumeSerial',
        'expectedStageFileId'
    )
    Assert-ExactProperties -Value $request -Allowed $requiredProperties -Required $requiredProperties
    foreach ($propertyName in $requiredProperties) {
        if ($request.$propertyName -isnot [string]) {
            throw 'schema'
        }
    }

    $expectedRootVolume = Assert-HexIdentity -Value $request.expectedRootVolumeSerial -Length 16
    $expectedRootFile = Assert-HexIdentity -Value $request.expectedRootFileId -Length 32
    $expectedStageVolume = Assert-HexIdentity -Value $request.expectedStageVolumeSerial -Length 16
    $expectedStageFile = Assert-HexIdentity -Value $request.expectedStageFileId -Length 32

    $root = Get-LocalCoordinate -Path $request.rootPath
    $stage = Get-LocalCoordinate -Path $request.stagePath
    $final = Get-LocalCoordinate -Path $request.finalPath
    if (-not [NumberDroidWindowsPublisher]::IsFixedDrive($root.VolumeRoot)) {
        throw 'filesystem'
    }
    if (-not [string]::Equals($root.VolumeRoot, $stage.VolumeRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
        -not [string]::Equals($root.VolumeRoot, $final.VolumeRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'coordinate'
    }

    $stageParent = [System.IO.Directory]::GetParent($stage.FullPath)
    $finalParent = [System.IO.Directory]::GetParent($final.FullPath)
    if ($null -eq $stageParent -or $null -eq $finalParent -or
        -not [string]::Equals($stageParent.FullName, $root.FullPath, [System.StringComparison]::OrdinalIgnoreCase) -or
        -not [string]::Equals($finalParent.FullName, $root.FullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'coordinate'
    }

    $stageName = [System.IO.Path]::GetFileName($stage.FullPath)
    $finalName = [System.IO.Path]::GetFileName($final.FullPath)
    $safeIdentity = '[A-Za-z0-9_-]{16,128}'
    $isBackup = $stageName -cmatch ('\A\.numberdroid-backup-stage-' + $safeIdentity + '\z') -and
        $finalName -cmatch ('\Abackup-' + $safeIdentity + '\z')
    $isRestore = $stageName -cmatch ('\A\.numberdroid-restore-stage-' + $safeIdentity + '\z') -and
        $finalName -cmatch ('\Aworkspace-copy-' + $safeIdentity + '\z')
    if (-not $isBackup -and -not $isRestore) {
        throw 'coordinate'
    }

    $firstStageProof = Inspect-Tree -FullPath $stage.FullPath -ConfiguredRootPath $root.FullPath -VolumeRoot $root.VolumeRoot
    $stageProof = Inspect-Tree -FullPath $stage.FullPath -ConfiguredRootPath $root.FullPath -VolumeRoot $root.VolumeRoot
    Assert-StableProofs -First $firstStageProof -Second $stageProof
    Assert-Identity -Actual $stageProof.Root -ExpectedVolume $expectedRootVolume -ExpectedFile $expectedRootFile
    Assert-Identity -Actual $stageProof.Target -ExpectedVolume $expectedStageVolume -ExpectedFile $expectedStageFile

    $finalState = [NumberDroidWindowsPublisher]::CoordinateState($final.FullPath)
    if ($finalState -eq 1) {
        Write-StableCode -Code 'BACKUP_DESTINATION_CONFLICT'
        return
    }
    if ($finalState -ne 0) {
        throw 'coordinate'
    }

    $publishResult = [NumberDroidWindowsPublisher]::Publish($stage.FullPath, $final.FullPath)
    if ($publishResult -eq 1) {
        Write-StableCode -Code 'BACKUP_DESTINATION_CONFLICT'
        return
    }
    if ($publishResult -ne 0) {
        Write-StableCode -Code 'BACKUP_DURABILITY_FAILED'
        return
    }
    $script:Published = $true

    $firstFinalProof = Inspect-Tree -FullPath $final.FullPath -ConfiguredRootPath $root.FullPath -VolumeRoot $root.VolumeRoot
    $finalProof = Inspect-Tree -FullPath $final.FullPath -ConfiguredRootPath $root.FullPath -VolumeRoot $root.VolumeRoot
    Assert-StableProofs -First $firstFinalProof -Second $finalProof
    Assert-Identity -Actual $finalProof.Root -ExpectedVolume $expectedRootVolume -ExpectedFile $expectedRootFile
    Assert-Identity -Actual $finalProof.Target -ExpectedVolume $expectedStageVolume -ExpectedFile $expectedStageFile

    Write-StableCode -Code 'OK'
} catch {
    if ($script:Published) {
        Write-StableCode -Code 'BACKUP_DURABILITY_FAILED'
    } else {
        Write-StableCode -Code 'BACKUP_PATH_UNSAFE'
    }
}
