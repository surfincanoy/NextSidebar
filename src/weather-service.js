// 小米天气服务：按城市名搜索坐标与 locationKey，再查当前天气与当天高低温。
// appKey / sign 取自 Breezy Weather 源码中的公开内置常量，用户无需申请密钥。
import Soup from 'gi://Soup?version=3.0';

import { presetCity } from './cities.js';

export const CITY_NAME = '苏州';
export const XIAOMI_BASE_URL = 'https://weatherapi.market.xiaomi.com/wtr-v3/';
export const APP_KEY = 'weather20151024';
export const SIGN = 'zUFJoAR2ZVrDy1vF3D07';

const LOCALE = 'zh_CN';

export function buildLocationUrl(name) {
    return `${XIAOMI_BASE_URL}location/city/search` +
        `?name=${encodeURIComponent(name)}&locale=${LOCALE}`;
}

/** 从城市搜索结果取第一条有效记录；天气接口必须带坐标，只给 locationKey 会报错。 */
export function parseLocation(text) {
    try {
        const arr = JSON.parse(text);
        if (!Array.isArray(arr)) return null;
        const hit = arr.find(item =>
            item?.status === 0 && typeof item.locationKey === 'string' && item.locationKey &&
            Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
        if (!hit) return null;
        return {
            locationKey: hit.locationKey,
            latitude: Number(hit.latitude),
            longitude: Number(hit.longitude),
            // 自定义城市用它定时区；预设城市用城市表的 IANA ID，可处理夏令时
            timeZoneShift: Number.isFinite(Number(hit.timeZoneShift))
                ? Number(hit.timeZoneShift) : null,
            name: typeof hit.name === 'string' ? hit.name : '',
            affiliation: typeof hit.affiliation === 'string' ? hit.affiliation : '',
        };
    } catch (e) {
        return null;
    }
}

export function buildForecastUrl(location) {
    return `${XIAOMI_BASE_URL}weather/all` +
        `?latitude=${location.latitude}&longitude=${location.longitude}` +
        `&locationKey=${encodeURIComponent(location.locationKey)}` +
        `&isLocated=false&days=2&appKey=${APP_KEY}&sign=${SIGN}` +
        `&isGlobal=false&locale=${LOCALE}`;
}

function isDayFrom(pubTime) {
    // 小米不返回 is_day；用观测时间的本地小时判断，06:00-17:59 为白天
    const hour = Number(String(pubTime ?? '').slice(11, 13));
    return hour >= 6 && hour < 18;
}

/** 解析小米天气响应；畸形或缺关键字段返回 null。
 *  dayHigh/dayLow 为当天的白天最高与夜间最低（forecastDaily 第一天的 from/to）。 */
export function parseForecast(text) {
    try {
        const obj = JSON.parse(text);
        const cur = obj?.current;
        const temp = Number(cur?.temperature?.value);
        const feels = Number(cur?.feelsLike?.value);
        const code = cur?.weather;
        if (!Number.isFinite(temp) || !Number.isFinite(feels) || typeof code !== 'string')
            return null;

        const today = obj?.forecastDaily?.temperature?.value?.[0];
        const dayHigh = Number(today?.from);
        const dayLow = Number(today?.to);
        return {
            temperature: temp,
            apparent: feels,
            code,
            isDay: isDayFrom(cur.pubTime),
            dayHigh: Number.isFinite(dayHigh) ? dayHigh : null,
            dayLow: Number.isFinite(dayLow) ? dayLow : null,
        };
    } catch (e) {
        return null;
    }
}

// 预设城市的位置可复用；自定义城市每次重搜，以便刷新夏令时后的 timeZoneShift
const locationCache = new Map();

function getText(result, session) {
    // 异步回调的 finish 必须传 Gio.AsyncResult，不是 Soup.Message
    const bytes = session.send_and_read_finish(result);
    return new TextDecoder().decode(bytes.get_data());
}

/** 异步拉取指定城市的天气。回调收到带 timeZoneShift / 归属地的结果，
 *  搜不到城市时为 null；天气解析失败仍回传时区信息，让时钟不中断。 */
export function fetchForecast(callback, city = CITY_NAME) {
    const session = new Soup.Session({ timeout: 10 });
    const send = (url, onText) => {
        const message = Soup.Message.new('GET', url);
        session.send_and_read_async(message, 0, null, (s, result) => {
            try {
                onText(getText(result, s));
            } catch (e) {
                log(`天气请求失败: ${e}`);
                callback(null);
            }
        });
    };

    const fetchWeather = location => {
        if (presetCity(city))
            locationCache.set(city, location);
        send(buildForecastUrl(location), text => {
            const forecast = parseForecast(text) ?? {};
            callback({
                ...forecast,
                timeZoneShift: location.timeZoneShift,
                name: location.name,
                affiliation: location.affiliation,
                city,
            });
        });
    };

    const cached = presetCity(city) ? locationCache.get(city) : null;
    if (cached) {
        fetchWeather(cached);
        return;
    }
    send(buildLocationUrl(city), text => {
        const location = parseLocation(text);
        if (!location) {
            log(`未找到城市 ${city}`);
            callback(null);
            return;
        }
        fetchWeather(location);
    });
}
