const Y = () => Promise.resolve().then(() => U), A = globalThis.__GLOBALS__.ReactJSXRuntime, { Fragment: Z, jsx: e, jsxs: a } = A;
"use" in globalThis.__GLOBALS__.React || (globalThis.__GLOBALS__.React.use = () => {
  throw new Error("`use` is not available in this version of React. Make currently only supports React 18, but `use` is only available in React 19+.");
});
globalThis.__GLOBALS__.React.Children;
globalThis.__GLOBALS__.React.cloneElement;
({
  ...globalThis.__GLOBALS__.React
});
const { Component: W, createContext: q, createElement: g, createFactory: J, createRef: X, forwardRef: N, Fragment: Q, isValidElement: ee, lazy: ae, memo: te, Profiler: le, PureComponent: ie, startTransition: re, StrictMode: se, Suspense: ne, use: ce, useCallback: oe, useContext: de, useDebugValue: me, useDeferredValue: he, useEffect: xe, useId: be, useImperativeHandle: fe, useInsertionEffect: pe, useLayoutEffect: ue, useMemo: ge, useReducer: ye, useRef: ke, useState: C, useSyncExternalStore: ve, useTransition: Ne, version: we, __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: ze } = globalThis.__GLOBALS__.React;
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const G = (t) => t.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), S = (t) => t.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (s, r, l) => l ? l.toUpperCase() : r.toLowerCase()
), y = (t) => {
  const s = S(t);
  return s.charAt(0).toUpperCase() + s.slice(1);
}, w = (...t) => t.filter((s, r, l) => !!s && s.trim() !== "" && l.indexOf(s) === r).join(" ").trim();
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var L = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const E = N(
  ({
    color: t = "currentColor",
    size: s = 24,
    strokeWidth: r = 2,
    absoluteStrokeWidth: l,
    className: n = "",
    children: i,
    iconNode: d,
    ...m
  }, h) => g(
    "svg",
    {
      ref: h,
      ...L,
      width: s,
      height: s,
      stroke: t,
      strokeWidth: l ? Number(r) * 24 / Number(s) : r,
      className: w("lucide", n),
      ...m
    },
    [
      ...d.map(([z, _]) => g(z, _)),
      ...Array.isArray(i) ? i : [i]
    ]
  )
);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const o = (t, s) => {
  const r = N(
    ({ className: l, ...n }, i) => g(E, {
      ref: i,
      iconNode: s,
      className: w(
        `lucide-${G(y(t))}`,
        `lucide-${t}`,
        l
      ),
      ...n
    })
  );
  return r.displayName = y(t), r;
};
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const H = [
  [
    "path",
    {
      d: "M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z",
      key: "3s7exb"
    }
  ],
  ["path", { d: "M10 2c1 .5 2 2 2 5", key: "fcco2y" }]
], k = o("apple", H);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const j = [
  ["path", { d: "M21.801 10A10 10 0 1 1 17 3.335", key: "yps3ct" }],
  ["path", { d: "m9 11 3 3L22 4", key: "1pflzl" }]
], D = o("circle-check-big", j);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const R = [
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["polyline", { points: "7 10 12 15 17 10", key: "2ggqvy" }],
  ["line", { x1: "12", x2: "12", y1: "15", y2: "3", key: "1vk2je" }]
], M = o("download", R);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const T = [["polygon", { points: "6 3 20 12 6 21 6 3", key: "1oa8hb" }]], F = o("play", T);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const P = [
  [
    "path",
    {
      d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
      key: "r04s7s"
    }
  ]
], B = o("star", P), x = "/_components/v2/66900067c3ae029b2fdfb5b594b0f14e3120ecf7/IMG_6014.a07ef887.PNG", I = "/_components/v2/66900067c3ae029b2fdfb5b594b0f14e3120ecf7/IMG_6016.10160aac.PNG", b = "/_components/v2/66900067c3ae029b2fdfb5b594b0f14e3120ecf7/IMG_6017.528c4caa.PNG", f = "/_components/v2/66900067c3ae029b2fdfb5b594b0f14e3120ecf7/IMG_6018.ede05b6f.PNG", O = "/_components/v2/66900067c3ae029b2fdfb5b594b0f14e3120ecf7/IMG_6019.835035a3.PNG", v = "/_components/v2/66900067c3ae029b2fdfb5b594b0f14e3120ecf7/IMG_6020.a1f6ba03.PNG", K = "/_components/v2/66900067c3ae029b2fdfb5b594b0f14e3120ecf7/IMG_6021.68d305dd.PNG";
function c({
  src: t,
  alt: s,
  className: r = "",
  scale: l = 1
}) {
  return /* @__PURE__ */ a(
    "div",
    {
      className: `relative flex-shrink-0 ${r}`,
      style: { width: 220 * l, height: 476 * l },
      children: [
        /* @__PURE__ */ e(
          "div",
          {
            className: "absolute inset-0 rounded-[44px] ring-[7px] ring-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden",
            style: { borderRadius: 44 * l },
            children: /* @__PURE__ */ e("img", { src: t, alt: s, className: "w-full h-full object-cover object-top" })
          }
        ),
        /* @__PURE__ */ e(
          "div",
          {
            className: "absolute top-0 left-1/2 -translate-x-1/2 bg-black z-10",
            style: {
              width: 80 * l,
              height: 22 * l,
              borderRadius: `0 0 ${14 * l}px ${14 * l}px`
            }
          }
        ),
        /* @__PURE__ */ e(
          "div",
          {
            className: "absolute right-0 bg-white/20 rounded-l",
            style: {
              top: 90 * l,
              width: 3 * l,
              height: 48 * l
            }
          }
        ),
        /* @__PURE__ */ e(
          "div",
          {
            className: "absolute left-0 bg-white/20 rounded-r",
            style: { top: 80 * l, width: 3 * l, height: 30 * l }
          }
        ),
        /* @__PURE__ */ e(
          "div",
          {
            className: "absolute left-0 bg-white/20 rounded-r",
            style: { top: 120 * l, width: 3 * l, height: 30 * l }
          }
        )
      ]
    }
  );
}
function p({ rating: t }) {
  return /* @__PURE__ */ e("div", { className: "flex gap-0.5", children: [1, 2, 3, 4, 5].map((s) => /* @__PURE__ */ e(
    B,
    {
      size: 14,
      className: s <= t ? "text-[#c8a200] fill-[#c8a200]" : "text-gray-600"
    },
    s
  )) });
}
function u({ children: t }) {
  return /* @__PURE__ */ a("div", { className: "flex items-center gap-2 mb-4", children: [
    /* @__PURE__ */ e("div", { className: "h-px flex-1 bg-white/10" }),
    /* @__PURE__ */ e(
      "span",
      {
        className: "text-xs font-bold tracking-[0.2em] uppercase",
        style: { color: "#c8a200", fontFamily: "Inter, sans-serif" },
        children: t
      }
    ),
    /* @__PURE__ */ e("div", { className: "h-px flex-1 bg-white/10" })
  ] });
}
function $({
  img: t,
  alt: s,
  title: r,
  tag: l,
  description: n,
  bullets: i,
  reverse: d = !1
}) {
  return /* @__PURE__ */ a(
    "div",
    {
      className: `flex flex-col lg:flex-row items-center gap-16 py-24 ${d ? "lg:flex-row-reverse" : ""}`,
      children: [
        /* @__PURE__ */ e("div", { className: "flex-shrink-0 flex items-end justify-center", style: { minWidth: 240 }, children: /* @__PURE__ */ e(c, { src: t, alt: s }) }),
        /* @__PURE__ */ a("div", { className: "flex-1 max-w-lg", children: [
          /* @__PURE__ */ e(
            "span",
            {
              className: "text-xs font-bold tracking-[0.18em] uppercase mb-4 block",
              style: { color: "#c8a200" },
              children: l
            }
          ),
          /* @__PURE__ */ e(
            "h2",
            {
              className: "text-4xl md:text-5xl font-black text-white leading-[1.05] mb-5",
              style: { fontFamily: "Nunito, sans-serif" },
              children: r
            }
          ),
          /* @__PURE__ */ e("p", { className: "text-gray-400 text-lg leading-relaxed mb-8", children: n }),
          /* @__PURE__ */ e("ul", { className: "space-y-3", children: i.map((m, h) => /* @__PURE__ */ a("li", { className: "flex items-start gap-3", children: [
            /* @__PURE__ */ e(D, { size: 16, className: "mt-0.5 flex-shrink-0", style: { color: "#c8a200" } }),
            /* @__PURE__ */ e("span", { className: "text-gray-300 text-sm leading-relaxed", children: m })
          ] }, h)) })
        ] })
      ]
    }
  );
}
function V() {
  const [t, s] = C(0), r = [
    { src: x, label: "Ana Sayfa" },
    { src: I, label: "Haberler" },
    { src: b, label: "Keşfet" },
    { src: f, label: "Etkinlik" },
    { src: O, label: "Şehir Rehberi" },
    { src: v, label: "Namaz Vakitleri" },
    { src: K, label: "Kapalı Yollar" }
  ], l = [
    {
      img: x,
      alt: "Ana Sayfa ekranı",
      tag: "Her şey bir bakışta",
      title: "Şehrin Nabzını Hisset",
      description: "Hava durumu, namaz vakti geri sayımı, nöbetçi eczane ve günün özeti — tek ekranda, gerçek zamanlı.",
      bullets: [
        "Canlı hava durumu ve namaz vakti geri sayımı",
        "Bugünün nöbetçi eczanesini anında görün",
        "Düziçi haberlerinin günlük özeti",
        "Keşfedilecek doğal güzellikler"
      ]
    },
    {
      img: b,
      alt: "Şehir hizmetleri ekranı",
      tag: "12 farklı hizmet",
      title: "Tüm Şehir Hizmetleri Elinizde",
      description: "Kapalı yollardan taksi çağırmaya, akaryakıt fiyatlarından emlak ilanlarına — Düziçi'nin tüm hizmetlerine tek merkezden erişin.",
      bullets: [
        "Gerçek zamanlı kapalı yol ve trafik bilgisi",
        "En yakın hastane ve nöbetçi eczane",
        "Dolmuş güzergahları ve durak bilgileri",
        "Yöresel pazar ve şehir fırsatları"
      ],
      reverse: !0
    },
    {
      img: f,
      alt: "Etkinlik takvimi ekranı",
      tag: "Hiçbir anı kaçırma",
      title: "Bölgenin En İyi Anları",
      description: "Konserler, kültür-sanat etkinlikleri, spor organizasyonları — etkinlik takvimi ile bölgedeki her şeyden haberdar olun.",
      bullets: [
        "Tarih bazlı filtreleme ve kategori seçimi",
        "Favorilere ekle ve takvimini oluştur",
        "Etkinlik öncesi alarm kur",
        "Biletli etkinlikler için hızlı yönlendirme"
      ]
    },
    {
      img: v,
      alt: "Namaz vakitleri ekranı",
      tag: "Dini hizmetler",
      title: "Namaz Vakitleri & Kıble",
      description: "Günlük tüm namaz vakitleri, bir sonraki vakite kalan süre ve pusula tabanlı kıble yönü bulma.",
      bullets: [
        "Sıradaki vakite geri sayım saati",
        "Tüm günlük namaz vakitleri",
        "Pusula ile kıble yönü tespiti",
        "Vakit bildirimleri"
      ],
      reverse: !0
    }
  ];
  return /* @__PURE__ */ a(
    "div",
    {
      className: "min-h-screen bg-background text-foreground",
      style: { fontFamily: "Inter, sans-serif" },
      children: [
        /* @__PURE__ */ e("nav", { className: "fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl", children: /* @__PURE__ */ a("div", { className: "max-w-6xl mx-auto px-6 h-16 flex items-center justify-between", children: [
          /* @__PURE__ */ a("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ e(
              "div",
              {
                className: "w-9 h-9 rounded-xl flex items-center justify-center text-[#090d18] font-black text-sm",
                style: { background: "#c8a200" },
                children: "HD"
              }
            ),
            /* @__PURE__ */ e("span", { className: "font-black text-white text-lg", style: { fontFamily: "Nunito, sans-serif" }, children: "Hepsi Düziçi" })
          ] }),
          /* @__PURE__ */ a("div", { className: "hidden md:flex items-center gap-8 text-sm text-gray-400", children: [
            /* @__PURE__ */ e("a", { href: "#features", className: "hover:text-white transition-colors", children: "Özellikler" }),
            /* @__PURE__ */ e("a", { href: "#screenshots", className: "hover:text-white transition-colors", children: "Ekran Görüntüleri" }),
            /* @__PURE__ */ e("a", { href: "#download", className: "hover:text-white transition-colors", children: "İndir" })
          ] }),
          /* @__PURE__ */ a(
            "a",
            {
              href: "#download",
              className: "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95",
              style: { background: "#c8a200", color: "#090d18" },
              children: [
                /* @__PURE__ */ e(M, { size: 14 }),
                "Ücretsiz İndir"
              ]
            }
          )
        ] }) }),
        /* @__PURE__ */ a("section", { className: "relative min-h-screen flex items-center pt-16 overflow-hidden", children: [
          /* @__PURE__ */ e(
            "div",
            {
              className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full opacity-10 blur-3xl pointer-events-none",
              style: { background: "radial-gradient(circle, #c8a200 0%, transparent 70%)" }
            }
          ),
          /* @__PURE__ */ e(
            "div",
            {
              className: "absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full opacity-5 blur-3xl pointer-events-none",
              style: { background: "#3b82f6" }
            }
          ),
          /* @__PURE__ */ e("div", { className: "max-w-6xl mx-auto px-6 w-full py-20", children: /* @__PURE__ */ a("div", { className: "flex flex-col lg:flex-row items-center gap-16", children: [
            /* @__PURE__ */ a("div", { className: "flex-1 text-center lg:text-left", children: [
              /* @__PURE__ */ a("div", { className: "inline-flex items-center gap-3 mb-8 px-4 py-2.5 rounded-2xl border border-white/10 bg-white/5", children: [
                /* @__PURE__ */ e(
                  "div",
                  {
                    className: "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs",
                    style: { background: "#c8a200", color: "#090d18" },
                    children: "HD"
                  }
                ),
                /* @__PURE__ */ a("div", { className: "text-left", children: [
                  /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ e(p, { rating: 5 }),
                    /* @__PURE__ */ e("span", { className: "text-xs text-gray-400", children: "4.8 • 2.4B değerlendirme" })
                  ] }),
                  /* @__PURE__ */ e("p", { className: "text-[10px] text-gray-500 mt-0.5", children: "App Store Editörün Seçimi" })
                ] })
              ] }),
              /* @__PURE__ */ a(
                "h1",
                {
                  className: "text-5xl md:text-7xl font-black text-white leading-[1.0] mb-6 tracking-tight",
                  style: { fontFamily: "Nunito, sans-serif" },
                  children: [
                    "Hepsi",
                    /* @__PURE__ */ e("span", { className: "block", style: { color: "#c8a200" }, children: "Düziçi" })
                  ]
                }
              ),
              /* @__PURE__ */ e("p", { className: "text-lg md:text-xl text-gray-400 leading-relaxed mb-3 max-w-lg mx-auto lg:mx-0", children: "Akdeniz'in İncisi Düziçi'nin tüm hizmetleri, haberleri, etkinlikleri ve dini bilgileri tek uygulamada." }),
              /* @__PURE__ */ e("p", { className: "text-sm text-gray-500 mb-10 max-w-md mx-auto lg:mx-0", children: "Ücretsiz · iOS & Android · Türkçe" }),
              /* @__PURE__ */ a("div", { className: "flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start", children: [
                /* @__PURE__ */ a(
                  "a",
                  {
                    href: "https://apps.apple.com/tr/app/hepsi-d%C3%BCzi%C3%A7i/id6775205369?l=tr",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-[#090d18] transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-[#c8a200]/20",
                    style: { background: "#c8a200" },
                    children: [
                      /* @__PURE__ */ e(k, { size: 18 }),
                      "App Store'dan İndir"
                    ]
                  }
                ),
                /* @__PURE__ */ a(
                  "a",
                  {
                    href: "#screenshots",
                    className: "flex items-center gap-3 px-6 py-3.5 rounded-2xl font-semibold text-white border border-white/15 hover:bg-white/5 transition-all",
                    children: [
                      /* @__PURE__ */ e(F, { size: 14, className: "fill-white" }),
                      "Ekran Görüntüleri"
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ e("div", { className: "flex items-center gap-8 mt-12 justify-center lg:justify-start", children: [
                { v: "50K+", l: "İndirme" },
                { v: "4.8", l: "Puan" },
                { v: "12", l: "Hizmet" },
                { v: "Ücretsiz", l: "Uygulama" }
              ].map((n, i) => /* @__PURE__ */ a("div", { className: "text-center lg:text-left", children: [
                /* @__PURE__ */ e("p", { className: "text-xl font-black text-white", style: { fontFamily: "Nunito, sans-serif" }, children: n.v }),
                /* @__PURE__ */ e("p", { className: "text-[11px] text-gray-500 uppercase tracking-wider", children: n.l })
              ] }, i)) })
            ] }),
            /* @__PURE__ */ a("div", { className: "flex-shrink-0 flex items-end gap-4", children: [
              /* @__PURE__ */ e(
                c,
                {
                  src: b,
                  alt: "Keşfet ekranı",
                  className: "hidden md:block opacity-60 translate-y-8",
                  scale: 0.82
                }
              ),
              /* @__PURE__ */ e(c, { src: x, alt: "Ana sayfa ekranı", scale: 1 }),
              /* @__PURE__ */ e(
                c,
                {
                  src: f,
                  alt: "Etkinlik ekranı",
                  className: "hidden md:block opacity-60 translate-y-8",
                  scale: 0.82
                }
              )
            ] })
          ] }) })
        ] }),
        /* @__PURE__ */ a("section", { id: "features", className: "max-w-6xl mx-auto px-6", children: [
          /* @__PURE__ */ a("div", { className: "text-center mb-6 pt-10", children: [
            /* @__PURE__ */ e(u, { children: "Özellikler" }),
            /* @__PURE__ */ a(
              "h2",
              {
                className: "text-4xl md:text-5xl font-black text-white",
                style: { fontFamily: "Nunito, sans-serif" },
                children: [
                  "Her ihtiyacınız için",
                  /* @__PURE__ */ e("span", { style: { color: "#c8a200" }, children: " bir özellik" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ e("div", { className: "flex flex-wrap gap-3 justify-center mb-4", children: [
            "🌤 Hava Durumu",
            "🕌 Namaz Vakitleri",
            "📰 Güncel Haberler",
            "🎭 Etkinlik Takvimi",
            "🚧 Kapalı Yollar",
            "💊 Nöbetçi Eczane",
            "🗺️ Şehir Rehberi",
            "⛽ Akaryakıt",
            "🚌 Dolmuş",
            "🏡 Emlak"
          ].map((n, i) => /* @__PURE__ */ e(
            "span",
            {
              className: "text-sm px-4 py-2 rounded-full border font-medium text-gray-300",
              style: { borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" },
              children: n
            },
            i
          )) }),
          /* @__PURE__ */ e("div", { className: "border-t border-white/7 mt-10" }),
          l.map((n, i) => /* @__PURE__ */ a("div", { children: [
            /* @__PURE__ */ e($, { ...n }),
            i < l.length - 1 && /* @__PURE__ */ e("div", { className: "border-t border-white/7" })
          ] }, i))
        ] }),
        /* @__PURE__ */ a("section", { id: "screenshots", className: "py-24 border-t border-white/7", children: [
          /* @__PURE__ */ a("div", { className: "max-w-6xl mx-auto px-6 text-center mb-14", children: [
            /* @__PURE__ */ e(u, { children: "Galeri" }),
            /* @__PURE__ */ e(
              "h2",
              {
                className: "text-4xl md:text-5xl font-black text-white mb-4",
                style: { fontFamily: "Nunito, sans-serif" },
                children: "Ekran Görüntüleri"
              }
            ),
            /* @__PURE__ */ e("p", { className: "text-gray-400 text-lg", children: "Her ekran, özenle tasarlanmış bir deneyim sunar." })
          ] }),
          /* @__PURE__ */ e("div", { className: "flex justify-center gap-2 flex-wrap mb-12 px-4", children: r.map((n, i) => /* @__PURE__ */ e(
            "button",
            {
              onClick: () => s(i),
              className: "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              style: t === i ? { background: "#c8a200", color: "#090d18" } : {
                background: "rgba(255,255,255,0.05)",
                color: "#9ca3af",
                border: "1px solid rgba(255,255,255,0.08)"
              },
              children: n.label
            },
            i
          )) }),
          /* @__PURE__ */ e("div", { className: "flex justify-center px-4", children: /* @__PURE__ */ a("div", { className: "relative flex items-end justify-center gap-6", children: [
            t > 0 && /* @__PURE__ */ e("div", { className: "hidden md:block opacity-30 translate-y-6 pointer-events-none", children: /* @__PURE__ */ e(
              c,
              {
                src: r[(t - 1 + r.length) % r.length].src,
                alt: "prev",
                scale: 0.78
              }
            ) }),
            /* @__PURE__ */ e("div", { className: "drop-shadow-2xl", children: /* @__PURE__ */ e(c, { src: r[t].src, alt: r[t].label, scale: 1.05 }) }),
            t < r.length - 1 && /* @__PURE__ */ e("div", { className: "hidden md:block opacity-30 translate-y-6 pointer-events-none", children: /* @__PURE__ */ e(
              c,
              {
                src: r[(t + 1) % r.length].src,
                alt: "next",
                scale: 0.78
              }
            ) })
          ] }) }),
          /* @__PURE__ */ e("div", { className: "flex justify-center gap-2 mt-10", children: r.map((n, i) => /* @__PURE__ */ e(
            "button",
            {
              onClick: () => s(i),
              className: "rounded-full transition-all",
              style: {
                width: t === i ? 24 : 8,
                height: 8,
                background: t === i ? "#c8a200" : "rgba(255,255,255,0.15)"
              }
            },
            i
          )) })
        ] }),
        /* @__PURE__ */ e("section", { className: "py-24 border-t border-white/7 bg-white/[0.02]", children: /* @__PURE__ */ a("div", { className: "max-w-6xl mx-auto px-6", children: [
          /* @__PURE__ */ a("div", { className: "text-center mb-14", children: [
            /* @__PURE__ */ e(u, { children: "Kullanıcı Yorumları" }),
            /* @__PURE__ */ e(
              "h2",
              {
                className: "text-4xl font-black text-white mb-2",
                style: { fontFamily: "Nunito, sans-serif" },
                children: "Düziçi halkı ne diyor?"
              }
            ),
            /* @__PURE__ */ a("div", { className: "flex items-center justify-center gap-3 mt-4", children: [
              /* @__PURE__ */ e(p, { rating: 5 }),
              /* @__PURE__ */ e("span", { className: "text-gray-400 text-sm", children: "4.8 ortalama · 2.400+ değerlendirme" })
            ] })
          ] }),
          /* @__PURE__ */ e("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-5", children: [
            {
              name: "Ayşe K.",
              stars: 5,
              date: "Haziran 2026",
              text: "Nöbetçi eczane özelliği inanılmaz faydalı! Gece acil ihtiyacımda hemen buldum. Teşekkürler!"
            },
            {
              name: "Mehmet D.",
              stars: 5,
              date: "Haziran 2026",
              text: "Namaz vakitleri ve kıble yönü özelliği çok güzel. Her sabah açıyorum, tam ihtiyacım olan her şey burada."
            },
            {
              name: "Fatma Ö.",
              stars: 5,
              date: "Mayıs 2026",
              text: "Etkinlik takvimi sayesinde hiçbir konseri kaçırmıyorum. Düziçi'nin en iyi uygulaması bu!"
            },
            {
              name: "İbrahim A.",
              stars: 5,
              date: "Mayıs 2026",
              text: "Kapalı yollar bölümü her gün işe gelirken kullanıyorum. Trafikten kurtuldum sayılırım."
            },
            {
              name: "Zeynep M.",
              stars: 4,
              date: "Nisan 2026",
              text: "Haberler ve etkinlikler için süper. Şehir rehberi de çok kapsamlı, her şey tek yerden."
            },
            {
              name: "Hasan B.",
              stars: 5,
              date: "Nisan 2026",
              text: "Düziçi'ye yeni taşındım, bu uygulama olmadan çok zorlanırdım. Her şey var, arayüz de çok güzel."
            }
          ].map((n, i) => /* @__PURE__ */ a(
            "div",
            {
              className: "p-5 rounded-2xl border",
              style: { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" },
              children: [
                /* @__PURE__ */ a("div", { className: "flex items-start justify-between mb-3", children: [
                  /* @__PURE__ */ a("div", { children: [
                    /* @__PURE__ */ e("p", { className: "text-white font-semibold text-sm", children: n.name }),
                    /* @__PURE__ */ e("p", { className: "text-gray-500 text-xs", children: n.date })
                  ] }),
                  /* @__PURE__ */ e(p, { rating: n.stars })
                ] }),
                /* @__PURE__ */ a("p", { className: "text-gray-300 text-sm leading-relaxed", children: [
                  '"',
                  n.text,
                  '"'
                ] })
              ]
            },
            i
          )) })
        ] }) }),
        /* @__PURE__ */ e("section", { id: "download", className: "py-24 border-t border-white/7", children: /* @__PURE__ */ e("div", { className: "max-w-6xl mx-auto px-6", children: /* @__PURE__ */ a(
          "div",
          {
            className: "relative rounded-3xl overflow-hidden p-12 md:p-16 text-center",
            style: { background: "linear-gradient(135deg, #1a1400 0%, #2a1f00 50%, #1a1400 100%)" },
            children: [
              /* @__PURE__ */ e(
                "div",
                {
                  className: "absolute inset-0 pointer-events-none",
                  style: {
                    background: "radial-gradient(ellipse at 50% 100%, rgba(200,162,0,0.15) 0%, transparent 70%)"
                  }
                }
              ),
              /* @__PURE__ */ e(
                "div",
                {
                  className: "absolute top-0 left-1/2 -translate-x-1/2 h-px w-48 opacity-60",
                  style: { background: "linear-gradient(90deg, transparent, #c8a200, transparent)" }
                }
              ),
              /* @__PURE__ */ a("div", { className: "relative z-10", children: [
                /* @__PURE__ */ e(
                  "div",
                  {
                    className: "inline-flex w-16 h-16 rounded-2xl items-center justify-center font-black text-xl mb-6 shadow-lg shadow-[#c8a200]/30",
                    style: { background: "#c8a200", color: "#090d18", fontFamily: "Nunito, sans-serif" },
                    children: "HD"
                  }
                ),
                /* @__PURE__ */ a(
                  "h2",
                  {
                    className: "text-4xl md:text-6xl font-black text-white mb-4",
                    style: { fontFamily: "Nunito, sans-serif" },
                    children: [
                      "Hepsi Düziçi'yi",
                      /* @__PURE__ */ e("span", { className: "block", style: { color: "#c8a200" }, children: "Şimdi İndir" })
                    ]
                  }
                ),
                /* @__PURE__ */ e("p", { className: "text-gray-400 text-lg mb-10 max-w-md mx-auto", children: "Ücretsiz, Türkçe, iOS ve Android. Düziçi'nin tüm hizmetleri cebinde." }),
                /* @__PURE__ */ a("div", { className: "flex flex-col sm:flex-row gap-4 justify-center", children: [
                  /* @__PURE__ */ a(
                    "a",
                    {
                      href: "https://apps.apple.com/tr/app/hepsi-d%C3%BCzi%C3%A7i/id6775205369?l=tr",
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className: "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-[#090d18] text-lg transition-all hover:opacity-90 active:scale-95 shadow-xl shadow-[#c8a200]/25",
                      style: { background: "#c8a200" },
                      children: [
                        /* @__PURE__ */ e(k, { size: 22 }),
                        "App Store"
                      ]
                    }
                  ),
                  /* @__PURE__ */ a(
                    "a",
                    {
                      href: "https://play.google.com/store/apps/details?id=net.hepsiduzici.hepsi_duzici",
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className: "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white text-lg border transition-all hover:bg-white/5",
                      style: { borderColor: "rgba(255,255,255,0.20)" },
                      children: [
                        /* @__PURE__ */ e("svg", { viewBox: "0 0 24 24", className: "w-5 h-5 fill-white", children: /* @__PURE__ */ e("path", { d: "M3.18 23.76c.3.17.65.18.97.05l12.43-7.17-2.79-2.79L3.18 23.76zm16.6-10.34L17.2 12l2.58-1.42L5.65.41C5.33.24 4.98.25 4.68.41L16.96 12.73l2.82-2.82.01.01zM1.01 1.02C.39 1.36 0 2.01 0 2.77v18.46c0 .76.39 1.41 1.01 1.75l.08.04 10.34-10.33v-.24L1.09.98l-.08.04zM20.27 10.43l-3.31-1.9-2.84 2.84 2.84 2.85 3.32-1.92c.95-.55.95-1.32-.01-1.87z" }) }),
                        "Google Play"
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ a("p", { className: "text-gray-600 text-xs mt-8", children: ["iOS 15+ ve Android 9+ gerektirir · ", /* @__PURE__ */ e("a", { href: "/gizlilik-politikasi", className: "underline hover:text-gray-300", children: "Gizlilik Politikası" }), " · ", /* @__PURE__ */ e("a", { href: "/kullanim-kosullari", className: "underline hover:text-gray-300", children: "Kullanım Koşulları" }), " · ", /* @__PURE__ */ e("a", { href: "/iletisim", className: "underline hover:text-gray-300", children: "İletişim" })] })
              ] })
            ]
          }
        ) }) }),
        /* @__PURE__ */ e("footer", { className: "border-t border-white/7 py-10", children: /* @__PURE__ */ a("div", { className: "max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4", children: [
          /* @__PURE__ */ a("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ e(
              "div",
              {
                className: "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs",
                style: { background: "#c8a200", color: "#090d18" },
                children: "HD"
              }
            ),
            /* @__PURE__ */ a("span", { className: "text-gray-400 text-sm", children: [
              /* @__PURE__ */ e("span", { className: "text-white font-semibold", children: "Hepsi Düziçi" }),
              " — Akdeniz'in İncisi"
            ] })
          ] }),
          /* @__PURE__ */ a("div", { className: "flex items-center gap-6 text-xs text-gray-600", children: [
            /* @__PURE__ */ e("a", { href: "/gizlilik-politikasi", className: "hover:text-gray-400 transition-colors", children: "Gizlilik" }),
            /* @__PURE__ */ e("a", { href: "/kullanim-kosullari", className: "hover:text-gray-400 transition-colors", children: "Koşullar" }),
            /* @__PURE__ */ e("a", { href: "/iletisim", className: "hover:text-gray-400 transition-colors", children: "İletişim" }),
            /* @__PURE__ */ e("span", { children: "© 2026 Hepsi Düziçi" })
          ] })
        ] }) })
      ]
    }
  );
}
const U = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: V
}, Symbol.toStringTag, { value: "Module" }));
export {
  Y as Code0_8
};
