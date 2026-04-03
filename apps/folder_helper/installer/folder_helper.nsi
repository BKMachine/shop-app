Unicode true

!ifndef APP_VERSION
  !define APP_VERSION "0.0.0"
!endif

!ifndef APP_EXE
  !error "APP_EXE must be provided"
!endif

!ifndef OUTPUT_FILE
  !error "OUTPUT_FILE must be provided"
!endif

!define APP_NAME "Shop App Folder Helper"
!define APP_PUBLISHER "BKMachine"
!define APP_PROTOCOL "shop-folder"
!define APP_INSTALL_DIR "$LOCALAPPDATA\BKMachine\Folder Helper"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"

Name "${APP_NAME}"
OutFile "${OUTPUT_FILE}"
InstallDir "${APP_INSTALL_DIR}"
RequestExecutionLevel user
SetCompressor /SOLID lzma

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File "/oname=folder_helper.exe" "${APP_EXE}"
  WriteUninstaller "$INSTDIR\Uninstall Folder Helper.exe"

  WriteRegStr HKCU "Software\Classes\${APP_PROTOCOL}" "" "URL:Shop Folder Protocol"
  WriteRegStr HKCU "Software\Classes\${APP_PROTOCOL}" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\${APP_PROTOCOL}\DefaultIcon" "" "$INSTDIR\folder_helper.exe,0"
  WriteRegStr HKCU "Software\Classes\${APP_PROTOCOL}\shell\open\command" "" "$\"$INSTDIR\folder_helper.exe$\" $\"%1$\""

  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\folder_helper.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" "$\"$INSTDIR\Uninstall Folder Helper.exe$\""
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  DeleteRegKey HKCU "Software\Classes\${APP_PROTOCOL}"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"

  Delete "$INSTDIR\folder_helper.exe"
  Delete "$INSTDIR\Uninstall Folder Helper.exe"
  RMDir "$INSTDIR"
SectionEnd