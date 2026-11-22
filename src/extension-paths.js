// 扩展资源路径解析。Extension.dir 是 Gio.File，须用 get_child 而非字符串拼接。
export function stylesheetFile(dir) {
    return dir.get_child('stylesheet.css');
}
