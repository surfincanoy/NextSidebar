// 自定义城市：GSettings 的 as 键每项存一个 JSON 字符串。
// 扩展搜到新城市后写入，设置窗口读出来拼进城市快捷表。
const MAX_CUSTOM_CITIES = 50;

/** 解析并过滤损坏条目，避免一条坏数据毁掉整张表。 */
export function parseCustomCities(strings) {
    const result = [];
    for (const raw of strings ?? []) {
        try {
            const item = JSON.parse(raw);
            if (typeof item?.name !== 'string' || !item.name ||
                !Number.isFinite(item.timeZoneShift))
                continue;
            result.push({
                name: item.name,
                timeZoneShift: item.timeZoneShift,
                affiliation: typeof item.affiliation === 'string' ? item.affiliation : '',
            });
        } catch (e) {
        }
    }
    return result;
}

/** 加入一个城市：同名去重并置顶（保留最新偏移），最多保留 MAX_CUSTOM_CITIES 个。 */
export function addCustomCity(strings, entry) {
    const list = parseCustomCities(strings);
    const others = list.filter(city => city.name !== entry.name);
    const next = [{
        name: entry.name,
        timeZoneShift: entry.timeZoneShift,
        affiliation: entry.affiliation ?? '',
    }, ...others].slice(0, MAX_CUSTOM_CITIES);
    return next.map(city => JSON.stringify(city));
}
