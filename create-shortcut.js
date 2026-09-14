const fs = require('fs');
const { execSync } = require('child_process');

const script = `
Set WshShell = CreateObject("WScript.Shell")
Set Shortcut = WshShell.CreateShortcut("C:\\Users\\Lenovo\\Desktop\\Unaib Computer Accessories POS.lnk")
Shortcut.TargetPath = "C:\\Users\\Lenovo\\Desktop\\Unaib-Computer-Accessories-POS.bat"
Shortcut.WorkingDirectory = "C:\\Users\\Lenovo\\.gemini\\antigravity\\scratch\\unaib-pos-desktop"
Shortcut.Description = "Unaib Computer Accessories Desktop POS System"
Shortcut.Save
`;

fs.writeFileSync('temp_create_shortcut.vbs', script);
try {
  execSync('cscript //nologo temp_create_shortcut.vbs');
  console.log('Shortcut created successfully on Desktop!');
} catch (err) {
  console.error('Failed to create shortcut:', err.message);
} finally {
  if (fs.existsSync('temp_create_shortcut.vbs')) {
    fs.unlinkSync('temp_create_shortcut.vbs');
  }
}
