//#region src/firefox/bridge-boundary.ts
var e = /^[A-Za-z0-9._+-]{1,64}$/u, t = /^window-[a-z0-9-]{1,64}$/u, n = /^FENNEVIA_[A-Z0-9_]{1,95}$/u, r = /^[A-Za-z][A-Za-z0-9:-]{0,63}$/u, i = /^[a-z][a-z0-9-]{0,31}$/u, a = /^[a-z][a-z0-9-]{0,31}-registry-[1-9][0-9]*-handle-[1-9][0-9]*$/u, o = /^[a-z][a-z0-9-]{0,95}$/u, s = /^[A-Za-z][A-Za-z0-9.[\]-]{0,127}$/u, c = new Set(), l = new WeakMap(), u = 0, d = (e) => typeof e == "object" && !!e || typeof e == "function", f = (e) => typeof e == "object" && !!e, p = (e) => f(e) && typeof e.addEventListener == "function" && typeof e.removeEventListener == "function", m = (t) => {
	let n = String(t ?? "");
	return e.test(n) ? n : "unknown";
}, h = (e) => Object.freeze({
	buildId: m(e?.buildId),
	firefoxVersion: m(e?.firefoxVersion),
	windowKind: e?.windowKind === "private" ? "private" : "normal"
}), g = class extends Error {
	constructor({ cause: e, code: t, context: r, phase: i, symbol: a }) {
		let c = n.test(t) ? t : "FENNEVIA_FIREFOX_BRIDGE_ERROR_INVALID";
		super(c);
		let l = h(r);
		Object.defineProperties(this, {
			cause: {
				configurable: !0,
				enumerable: !1,
				value: e
			},
			fenneviaBuildId: {
				enumerable: !1,
				value: l.buildId
			},
			fenneviaCode: {
				enumerable: !1,
				value: c
			},
			fenneviaFirefoxVersion: {
				enumerable: !1,
				value: l.firefoxVersion
			},
			fenneviaPhase: {
				enumerable: !1,
				value: o.test(i) ? i : "firefox-bridge-error"
			},
			fenneviaSymbol: {
				enumerable: !1,
				value: s.test(a) ? a : "firefox.unknown"
			},
			fenneviaWindowKind: {
				enumerable: !1,
				value: l.windowKind
			},
			name: {
				configurable: !0,
				enumerable: !1,
				value: "FenneviaFirefoxBridgeError"
			}
		});
	}
};
function _(e) {
	return e instanceof g || f(e) && e.name === "FenneviaFirefoxBridgeError" && typeof e.fenneviaCode == "string" && typeof e.fenneviaPhase == "string" && typeof e.fenneviaSymbol == "string";
}
function v(e) {
	if (!_(e)) throw TypeError("FENNEVIA_FIREFOX_DIAGNOSTIC_ERROR_INVALID");
	return Object.freeze({
		buildId: e.fenneviaBuildId,
		code: e.fenneviaCode,
		firefoxVersion: e.fenneviaFirefoxVersion,
		phase: e.fenneviaPhase,
		symbol: e.fenneviaSymbol,
		windowKind: e.fenneviaWindowKind
	});
}
var y = (e, t, n, r, i) => new g({
	cause: i,
	code: e,
	context: r,
	phase: t,
	symbol: n
});
function b(e) {
	if (typeof e != "function") throw TypeError("FENNEVIA_FIREFOX_DISPOSER_INVALID");
	let t = !0;
	return Object.freeze(() => t ? (t = !1, e(), !0) : !1);
}
function x({ listener: e, options: t, target: n, type: i }) {
	if (!p(n) || typeof e != "function" || !r.test(i)) throw TypeError("FENNEVIA_FIREFOX_SUBSCRIPTION_INVALID");
	return n.addEventListener(i, e, t), b(() => {
		n.removeEventListener(i, e, t);
	});
}
function S({ context: e, kind: t }) {
	if (!i.test(t)) throw TypeError("FENNEVIA_FIREFOX_HANDLE_KIND_INVALID");
	let n = h(e), r = `${t}-registry-${++u}-handle-`, o = 0, s = !1, c = new WeakMap(), l = new Map(), f = (e) => {
		if (s) throw y("FENNEVIA_FIREFOX_HANDLE_REGISTRY_DISPOSED", e, `${t}.opaque-id`, n);
	}, p = (e, i) => {
		if (f(i), typeof e != "string" || !a.test(e)) throw y("FENNEVIA_FIREFOX_HANDLE_ID_INVALID", i, `${t}.opaque-id`, n);
		if (!e.startsWith(r)) throw y("FENNEVIA_FIREFOX_HANDLE_CONTEXT_MISMATCH", i, `${t}.opaque-id`, n);
		let o = l.get(e);
		if (!o) throw y("FENNEVIA_FIREFOX_HANDLE_STALE", i, `${t}.opaque-id`, n);
		return o;
	};
	return Object.freeze({
		dispose() {
			return !s && (s = !0, l.clear(), c = new WeakMap(), !0);
		},
		register(e) {
			if (f("firefox-handle-register"), !d(e)) throw y("FENNEVIA_FIREFOX_HANDLE_INVALID", "firefox-handle-register", `${t}.native-handle`, n);
			let i = c.get(e);
			if (i) return i;
			let a = `${r}${++o}`;
			return c.set(e, a), l.set(a, e), a;
		},
		release(e) {
			let t = p(e, "firefox-handle-release");
			return l.delete(e), c.delete(t), !0;
		},
		resolve(e) {
			return p(e, "firefox-handle-resolve");
		},
		snapshot() {
			return Object.freeze({
				activeHandleCount: l.size,
				disposed: s,
				kind: t
			});
		}
	});
}
var C = Object.freeze([
	Object.freeze({
		isAvailable: f,
		name: "firefox.g-browser",
		read: (e) => e.gBrowser,
		requirement: "required",
		symbol: "window.gBrowser"
	}),
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.tabs",
		read: (e) => f(e.gBrowser) ? e.gBrowser.tabs : void 0,
		requirement: "required",
		symbol: "window.gBrowser.tabs"
	}),
	Object.freeze({
		isAvailable: p,
		name: "firefox.tab-events",
		read: (e) => f(e.gBrowser) ? e.gBrowser.tabContainer : void 0,
		requirement: "required",
		symbol: "window.gBrowser.tabContainer"
	}),
	Object.freeze({
		isAvailable: d,
		name: "firefox.selected-browser",
		read: (e) => f(e.gBrowser) ? e.gBrowser.selectedBrowser : void 0,
		requirement: "required",
		symbol: "window.gBrowser.selectedBrowser"
	}),
	Object.freeze({
		isAvailable: (e) => e === !0,
		name: "firefox.web-navigation",
		read: (e) => {
			let t = f(e.gBrowser) ? e.gBrowser.selectedBrowser : void 0;
			return d(t) && "webNavigation" in t;
		},
		requirement: "optional",
		symbol: "window.gBrowser.selectedBrowser.webNavigation"
	})
]), w = (e) => Object.freeze(C.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: t.requirement,
			symbol: t.symbol
		})
	});
}));
function T({ buildId: e, contextId: n, firefoxVersion: r, window: i, windowKind: a }) {
	let o = h({
		buildId: e,
		firefoxVersion: r,
		windowKind: a
	});
	if (!f(i) || !t.test(n) || a !== "normal" && a !== "private") throw y("FENNEVIA_FIREFOX_CONTEXT_INVALID", "firefox-context-create", "window", o);
	let s = i.document;
	if (!f(s) || s.documentURI !== "chrome://browser/content/browser.xhtml" || s.defaultView !== i) throw y("FENNEVIA_FIREFOX_CONTEXT_DOCUMENT_INVALID", "firefox-context-create", "window.document.defaultView", o);
	if (c.has(n) || l.has(i)) throw y("FENNEVIA_FIREFOX_CONTEXT_ALREADY_ACTIVE", "firefox-context-create", "window", o);
	c.add(n), l.set(i, n);
	let u = i, d = !1, p = new Set(), m = new Set(), g = () => {
		if (d || !u) throw y("FENNEVIA_FIREFOX_CONTEXT_DISPOSED", "firefox-context-access", "window", o);
		return u;
	}, _ = () => Object.freeze(w(g()).map((e) => e.snapshot));
	return Object.freeze({
		assertOwnsWindow(e) {
			if (e !== g()) throw y("FENNEVIA_FIREFOX_CONTEXT_WINDOW_MISMATCH", "firefox-context-access", "window", o);
			return !0;
		},
		assertRequiredCapabilities() {
			let e = w(g()), t = e.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
			if (t) throw y("FENNEVIA_FIREFOX_CAPABILITY_MISSING", "firefox-bridge-capability", t.snapshot.symbol, o, t.cause);
			return Object.freeze(e.map((e) => e.snapshot));
		},
		createHandleRegistry(e) {
			g();
			let t = S({
				context: o,
				kind: e
			});
			return m.add(t), t;
		},
		dispose() {
			if (d) return !1;
			d = !0, c.delete(n), l.delete(i), u = null;
			let e;
			for (let t of Array.from(p).reverse()) try {
				t();
			} catch (t) {
				e ??= t;
			}
			p.clear();
			for (let t of m) try {
				t.dispose();
			} catch (t) {
				e ??= t;
			}
			if (m.clear(), e !== void 0) throw y("FENNEVIA_FIREFOX_CONTEXT_DISPOSE_FAILED", "firefox-context-dispose", "window", o, e);
			return !0;
		},
		getCapabilities: _,
		snapshot() {
			let e = d ? [] : _();
			return Object.freeze({
				buildId: o.buildId,
				capabilityCount: e.length,
				contextId: n,
				disposed: d,
				firefoxVersion: o.firefoxVersion,
				optionalCapabilityCount: e.filter((e) => e.requirement === "optional").length,
				registryCount: m.size,
				requiredCapabilityCount: e.filter((e) => e.requirement === "required").length,
				subscriptionCount: p.size,
				windowKind: o.windowKind
			});
		},
		subscribe(e, t, n, r) {
			g();
			let i = x({
				listener: n,
				options: r,
				target: e,
				type: t
			}), a = b(() => {
				p.delete(a), i();
			});
			return p.add(a), a;
		}
	});
}
//#endregion
//#region src/firefox/bookmarks.ts
var ee = "resource://gre/modules/PlacesUtils.sys.mjs", E = "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs", te = Object.freeze([
	"bookmark-added",
	"bookmark-removed",
	"bookmark-moved",
	"bookmark-title-changed",
	"bookmark-url-changed"
]), D = 16, O = 128, ne = 1e6, k = /^[A-Za-z0-9_-]{12}$/u, A = new Set([
	"data:",
	"javascript:",
	"place:",
	"vbscript:"
]), j = (e) => typeof e == "object" && !!e, M = (e) => typeof e == "function", N = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, P = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: N(e),
	phase: n,
	symbol: r
}), F = (e, t, n, r) => {
	if (typeof t != "string" || !k.test(t)) throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_GUID_INVALID", n, r);
	return t;
}, I = (e) => {
	let t = "", n = 0;
	for (let r of e) {
		if (n >= 160) break;
		t += r, n += 1;
	}
	return t;
}, re = (e, t, n, r, i) => {
	if (!j(t) || typeof t.guid != "string" || typeof t.parentGuid != "string" || typeof t.index != "number" || !Number.isSafeInteger(t.index) || t.index < 0 || typeof t.type != "number" || typeof t.title != "string" || (F(e, t.guid, r, "PlacesUtils.bookmarks.fetch.result.guid"), F(e, t.parentGuid, r, "PlacesUtils.bookmarks.fetch.result.parentGuid"), i !== void 0 && t.guid !== i || ![
		n.TYPE_BOOKMARK,
		n.TYPE_FOLDER,
		n.TYPE_SEPARATOR
	].includes(t.type) || t.type === n.TYPE_FOLDER && (!Number.isSafeInteger(t.childCount) || t.childCount < 0))) throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID", r, "PlacesUtils.bookmarks.fetch.result");
	return t;
}, ie = (e, t, n) => {
	if (t.type === n.TYPE_BOOKMARK) return "bookmark";
	if (t.type === n.TYPE_FOLDER) return "folder";
	if (t.type === n.TYPE_SEPARATOR) return "separator";
	throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_TYPE_INVALID", "firefox-bookmarks-snapshot", "PlacesUtils.bookmarks.TYPE_BOOKMARK");
}, ae = (e) => {
	if (!j(e) || typeof e.href != "string") return null;
	if (typeof e.protocol == "string") return e.protocol.toLowerCase();
	let t = e.href.indexOf(":");
	return t > 0 ? `${e.href.slice(0, t).toLowerCase()}:` : null;
};
function oe({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !j(r) || typeof t != "function" || typeof n != "function") throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_OPTIONS_INVALID", "firefox-bookmarks-create", "ChromeUtils.importESModule");
	let i, a;
	try {
		i = t(ee), a = t(E);
	} catch (t) {
		throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_MODULE_LOAD_FAILED", "firefox-bookmarks-module-load", "ChromeUtils.importESModule", t);
	}
	let o = j(i) ? i.PlacesUtils : void 0, s = j(a) ? a.PlacesUIUtils : void 0, c = o, l = s, u = Object.freeze([
		Object.freeze({
			isAvailable: j,
			name: "firefox.places-utils",
			read: () => o,
			symbol: "PlacesUtils"
		}),
		Object.freeze({
			isAvailable: j,
			name: "firefox.places-bookmarks",
			read: () => c?.bookmarks,
			symbol: "PlacesUtils.bookmarks"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-bookmarks-fetch",
			read: () => c?.bookmarks?.fetch,
			symbol: "PlacesUtils.bookmarks.fetch"
		}),
		Object.freeze({
			isAvailable: (e) => Array.isArray(e) && e.length === 4 && e.every((e) => typeof e == "string" && k.test(e)),
			name: "firefox.places-bookmark-roots",
			read: () => c?.bookmarks?.userContentRoots,
			symbol: "PlacesUtils.bookmarks.userContentRoots"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-root-title",
			read: () => c?.bookmarks?.getLocalizedTitle,
			symbol: "PlacesUtils.bookmarks.getLocalizedTitle"
		}),
		Object.freeze({
			isAvailable: j,
			name: "firefox.places-observers",
			read: () => c?.observers,
			symbol: "PlacesUtils.observers"
		}),
		...["addListener", "removeListener"].map((e) => Object.freeze({
			isAvailable: M,
			name: `firefox.places-observers-${e.toLowerCase()}`,
			read: () => c?.observers?.[e],
			symbol: `PlacesUtils.observers.${e}`
		})),
		Object.freeze({
			isAvailable: j,
			name: "firefox.places-ui-utils",
			read: () => s,
			symbol: "PlacesUIUtils"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-node-conversion",
			read: () => l?.promiseNodeLikeFromFetchInfo,
			symbol: "PlacesUIUtils.promiseNodeLikeFromFetchInfo"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-open-node",
			read: () => l?.openNodeIn,
			symbol: "PlacesUIUtils.openNodeIn"
		})
	]), d = r, f = !1, p = null, m = !1, h = 0, g = new Set(), v = e.createHandleRegistry("bookmark"), y = new Map(), x = new Map(), S = () => {
		if (f || !d) throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSED", "firefox-bookmarks-access", "window");
		if (p) throw p;
		return e.assertOwnsWindow(d), d;
	}, C = () => Object.freeze(u.map((e) => {
		let t = !1, n;
		try {
			t = e.isAvailable(e.read());
		} catch (e) {
			n = e;
		}
		return Object.freeze({
			...n === void 0 ? {} : { cause: n },
			snapshot: Object.freeze({
				available: t,
				name: e.name,
				requirement: "required",
				symbol: e.symbol
			})
		});
	})), w = () => {
		S();
		let t = C(), n = t.find((e) => !e.snapshot.available);
		if (n) throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING", "firefox-bookmarks-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (t) => {
		S();
		let n = F(e, t, "firefox-bookmarks-handle", "PlacesUtils.bookmarks.guid"), r = x.get(n);
		if (r) return r;
		let i = Object.freeze({ guid: n }), a = v.register(i);
		return y.set(n, i), x.set(n, a), a;
	}, N = (e) => {
		if (typeof e != "string" || !k.test(e)) return !1;
		let t = x.get(e);
		if (!t) return !1;
		x.delete(e), y.delete(e);
		try {
			return v.release(t);
		} catch {
			return !1;
		}
	}, oe = (e) => (S(), v.resolve(e).guid), se = (t, n = t.title) => {
		let r = ie(e, t, c.bookmarks);
		return Object.freeze({
			hasChildren: r === "folder" && Number.isSafeInteger(t.childCount) && t.childCount > 0,
			id: T(t.guid),
			kind: r,
			title: I(n)
		});
	}, ce = async (t, n) => {
		S();
		let r;
		try {
			r = await Reflect.apply(c.bookmarks.fetch, c.bookmarks, [t]);
		} catch (t) {
			throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_FAILED", n, "PlacesUtils.bookmarks.fetch", t);
		}
		return S(), r === null ? null : re(e, r, c.bookmarks, n, "guid" in t ? t.guid : void 0);
	}, le = (t, r) => {
		h += 1;
		let i = Object.freeze({
			parentIds: Object.freeze([...t]),
			revision: h,
			scope: r,
			type: "changed"
		});
		for (let t of Array.from(g)) try {
			t(i);
		} catch (t) {
			n(P(e, "FENNEVIA_FIREFOX_BOOKMARKS_SUBSCRIBER_FAILED", "firefox-bookmarks-notify", "bookmarks.subscribe", t));
		}
	}, L = (t) => {
		p = _(t) ? t : P(e, "FENNEVIA_FIREFOX_BOOKMARKS_OBSERVER_FAILED", "firefox-bookmarks-observer", "PlacesUtils.observers.addListener", t), n(p);
	}, R = (t) => {
		if (!(f || p)) try {
			if (!Array.isArray(t)) throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEventCallback.events");
			if (t.length > O) {
				le(Object.freeze([]), "all");
				return;
			}
			let n = new Set(), r = [];
			for (let i of t) {
				if (!j(i) || typeof i.type != "string" || !te.includes(i.type) || typeof i.parentGuid != "string" || typeof i.isTagging != "boolean") throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEvent");
				if (i.isTagging) continue;
				F(e, i.parentGuid, "firefox-bookmarks-observer", "PlacesEvent.parentGuid");
				let t = x.get(i.parentGuid);
				if (t && n.add(t), i.type === "bookmark-moved") {
					let t = F(e, i.oldParentGuid, "firefox-bookmarks-observer", "PlacesBookmarkMoved.oldParentGuid"), r = x.get(t);
					r && n.add(r);
				}
				i.type === "bookmark-removed" && r.push(F(e, i.guid, "firefox-bookmarks-observer", "PlacesBookmarkRemoved.guid"));
			}
			let i = Array.from(n);
			i.length > D ? le(Object.freeze([]), "all") : i.length > 0 && le(Object.freeze(i), "parents");
			for (let e of r) N(e);
		} catch (e) {
			L(e);
		}
	}, z = b(() => {
		m && (m = !1, Reflect.apply(c.observers.removeListener, c.observers, [te, R]));
	}), B = Object.freeze({
		async children(t, n = {}) {
			let r;
			try {
				r = oe(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					parentId: t,
					status: "stale"
				});
				throw e;
			}
			if (!j(n) || Object.keys(n).some((e) => e !== "limit" && e !== "offset")) throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let i = n.limit ?? 32, a = n.offset ?? 0;
			if (!Number.isSafeInteger(i) || i < 1 || i > 32 || !Number.isSafeInteger(a) || a < 0 || a > ne) throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let o = await ce({ guid: r }, "firefox-bookmarks-query-parent");
			if (!o) return N(r), Object.freeze({
				parentId: t,
				status: "stale"
			});
			if (o.type !== c.bookmarks.TYPE_FOLDER) return Object.freeze({
				parentId: t,
				status: "stale"
			});
			let s = o.childCount, l = s === 0 ? 0 : Math.min(a, Math.floor((s - 1) / i) * i), u = Math.min(s, l + i), d = [];
			for (let e = l; e < u; e += 1) {
				let n = await ce({
					index: e,
					parentGuid: r
				}, "firefox-bookmarks-query-child");
				if (!n || n.parentGuid !== r || n.index !== e) return Object.freeze({
					parentId: t,
					status: "stale"
				});
				d.push(se(n));
			}
			return Object.freeze({
				items: Object.freeze(d),
				offset: l,
				parentId: t,
				status: "ok",
				totalCount: s,
				truncated: l + d.length < s
			});
		},
		async open(t, n = "current") {
			if (n !== "current" && n !== "new-tab") throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_DISPOSITION_INVALID", "firefox-bookmarks-open", "bookmarks.open.disposition");
			let r;
			try {
				r = oe(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					reason: "stale",
					status: "rejected"
				});
				throw e;
			}
			let i = await ce({ guid: r }, "firefox-bookmarks-open-fetch");
			if (!i) return N(r), Object.freeze({
				reason: "stale",
				status: "rejected"
			});
			if (i.type !== c.bookmarks.TYPE_BOOKMARK) return Object.freeze({
				reason: "not-bookmark",
				status: "rejected"
			});
			let a = ae(i.url);
			if (!a || A.has(a)) return Object.freeze({
				reason: "unsupported-scheme",
				status: "rejected"
			});
			let o;
			try {
				o = await Reflect.apply(l.promiseNodeLikeFromFetchInfo, l, [i]);
				let t = S();
				Reflect.apply(l.openNodeIn, l, [
					o,
					n === "new-tab" ? "tab" : "current",
					{ ownerWindow: t },
					e.snapshot().windowKind === "private"
				]);
			} catch (t) {
				throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_OPEN_FAILED", "firefox-bookmarks-open", "PlacesUIUtils.openNodeIn", t);
			}
			return Object.freeze({ status: "opened" });
		},
		async roots() {
			S();
			let t = c.bookmarks.userContentRoots, n = [];
			for (let r of t) {
				let t = await ce({ guid: r }, "firefox-bookmarks-query-roots");
				if (!t || t.type !== c.bookmarks.TYPE_FOLDER) throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.userContentRoots");
				let i;
				try {
					i = Reflect.apply(c.bookmarks.getLocalizedTitle, c.bookmarks, [t]);
				} catch (t) {
					throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_FAILED", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle", t);
				}
				if (typeof i != "string") throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle");
				n.push(se(t, i));
			}
			return Object.freeze(n);
		},
		subscribe(t) {
			if (S(), typeof t != "function") throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_LISTENER_INVALID", "firefox-bookmarks-subscribe", "bookmarks.subscribe");
			return g.add(t), b(() => {
				g.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), Reflect.apply(c.observers.addListener, c.observers, [te, R]), m = !0;
	} catch (t) {
		f = !0, d = null;
		let r;
		try {
			z();
		} catch (e) {
			r = e;
		}
		try {
			v.dispose();
		} catch (e) {
			r ??= e;
		}
		throw r !== void 0 && n(P(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", r)), t;
	}
	return Object.freeze({
		assertRequiredCapabilities: w,
		bookmarks: B,
		dispose() {
			if (f) return !1;
			f = !0, d = null;
			let t;
			try {
				z();
			} catch (e) {
				t = e;
			}
			g.clear(), y.clear(), x.clear();
			try {
				v.dispose();
			} catch (e) {
				t ??= e;
			}
			if (t !== void 0) throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", t);
			return !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: f,
				failed: p !== null,
				handleCount: x.size,
				observerRegistered: m,
				revision: h,
				subscriberCount: g.size
			});
		}
	});
}
//#endregion
//#region src/app/browser-tools-state.ts
var se = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"application-menu",
	"settings",
	"customize",
	"native-toolbar"
]), ce = new Set(se);
function le(e) {
	return typeof e == "string" && ce.has(e);
}
//#endregion
//#region src/firefox/browser-tools.ts
var L = (e) => typeof e == "object" && !!e, R = (e) => typeof e == "function", z = (e) => L(e) && R(e.click) && R(e.focus), B = (e, t) => {
	let n = e.document;
	if (!(!L(n) || !R(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, V = (e) => Object.freeze(e), ue = Object.freeze([
	V({
		isAvailable: (e) => z(e) && R(e.checkVisibility),
		name: "browser-tools.trust-anchor",
		read: (e) => B(e, "trust-icon-container"),
		symbol: "document.trust-icon-container.click.focus.checkVisibility"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.identity-anchor",
		read: (e) => B(e, "identity-icon-box"),
		symbol: "document.identity-icon-box.click.focus"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.protections-anchor",
		read: (e) => B(e, "tracking-protection-icon-container"),
		symbol: "document.tracking-protection-icon-container.click.focus"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.permissions-anchor",
		read: (e) => B(e, "identity-permission-box"),
		symbol: "document.identity-permission-box.click.focus"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.downloads-anchor",
		read: (e) => B(e, "downloads-button"),
		symbol: "document.downloads-button.click.focus"
	}),
	V({
		isAvailable: R,
		name: "browser-tools.unified-extensions",
		read: (e) => L(e.gUnifiedExtensions) ? e.gUnifiedExtensions.togglePanel : void 0,
		symbol: "window.gUnifiedExtensions.togglePanel"
	}),
	V({
		isAvailable: R,
		name: "browser-tools.application-menu",
		read: (e) => L(e.PanelUI) ? e.PanelUI.show : void 0,
		symbol: "window.PanelUI.show"
	}),
	V({
		isAvailable: R,
		name: "browser-tools.settings",
		read: (e) => e.openPreferences,
		symbol: "window.openPreferences"
	}),
	V({
		isAvailable: R,
		name: "browser-tools.customize",
		read: (e) => L(e.gCustomizeMode) ? e.gCustomizeMode.enter : void 0,
		symbol: "window.gCustomizeMode.enter"
	}),
	V({
		isAvailable: (e) => L(e) && R(e.focus),
		name: "browser-tools.native-toolbar-focus",
		read: (e) => B(e, "back-button"),
		symbol: "document.back-button.focus"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.extensions-anchor",
		read: (e) => B(e, "unified-extensions-button"),
		symbol: "document.unified-extensions-button.click.focus"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.application-menu-anchor",
		read: (e) => B(e, "PanelUI-menu-button"),
		symbol: "document.PanelUI-menu-button.click.focus"
	})
]), de = (e) => Object.freeze(ue.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: "required",
			symbol: t.symbol
		})
	});
})), fe = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, H = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: fe(e),
	phase: n,
	symbol: r
}), pe = (e) => {
	let t = (t) => e.some((e) => e.snapshot.name === t && e.snapshot.available);
	return Object.freeze({
		applicationMenu: t("browser-tools.application-menu"),
		customize: t("browser-tools.customize"),
		downloads: t("browser-tools.downloads-anchor"),
		extensions: t("browser-tools.unified-extensions"),
		nativeToolbar: t("browser-tools.native-toolbar-focus"),
		protections: t("browser-tools.trust-anchor") && t("browser-tools.protections-anchor"),
		settings: t("browser-tools.settings"),
		siteInformation: t("browser-tools.trust-anchor") && t("browser-tools.identity-anchor"),
		sitePermissions: t("browser-tools.permissions-anchor")
	});
};
function me({ boundary: e, requestNativeUiReveal: t, window: n }) {
	if (e.assertOwnsWindow(n), !L(n) || typeof t != "function") throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID", "firefox-browser-tools-create", "window");
	let r = n, i = !1, a = 0, o = () => {
		if (i || !r) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED", "firefox-browser-tools-access", "window");
		return r;
	}, s = () => {
		let t = de(o()), n = t.find((e) => !e.snapshot.available);
		if (n) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, c = () => {
		let n;
		try {
			n = t() === !0;
		} catch (t) {
			throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_FAILED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar", t);
		}
		if (!n) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar");
	}, l = async (t, n, r) => {
		let i = t[n];
		if (!R(i)) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", r);
		try {
			await Reflect.apply(i, t, []);
		} catch (t) {
			throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", r, t);
		}
	}, u = (t, n) => {
		let r = B(t, n);
		if (!z(r)) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", `document.${n}.click.focus`);
		return r;
	}, d = (t, n) => {
		try {
			Reflect.apply(t.focus, t, [Object.freeze({ preventScroll: !0 })]);
		} catch (t) {
			throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", n, t);
		}
	}, f = async (t, n) => {
		c();
		let r = u(t, n);
		d(r, `document.${n}.focus`);
		try {
			await Reflect.apply(r.click, r, []);
		} catch (t) {
			throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", `document.${n}.click`, t);
		}
	}, p = async (t, n) => {
		c();
		let r = u(t, "trust-icon-container"), i = r.checkVisibility;
		if (!R(i)) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "document.trust-icon-container.checkVisibility");
		let a;
		try {
			a = Reflect.apply(i, r, []) === !0;
		} catch (t) {
			throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.trust-icon-container.checkVisibility", t);
		}
		let o = a ? "trust-icon-container" : n, s = a ? r : u(t, o);
		d(s, `document.${o}.focus`);
		try {
			await Reflect.apply(s.click, s, []);
		} catch (t) {
			throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", `document.${o}.click`, t);
		}
	}, m = Object.freeze({
		invoke: async (t) => {
			if (!le(t)) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			let n = o();
			a += 1;
			try {
				switch (t) {
					case "site-information": return await p(n, "identity-icon-box"), !0;
					case "protections": return await p(n, "tracking-protection-icon-container"), !0;
					case "site-permissions": return await f(n, "identity-permission-box"), !0;
					case "downloads": return await f(n, "downloads-button"), !0;
					case "extensions": {
						c();
						let t = u(n, "unified-extensions-button");
						if (d(t, "document.unified-extensions-button.focus"), !L(n.gUnifiedExtensions)) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gUnifiedExtensions.togglePanel");
						return await l(n.gUnifiedExtensions, "togglePanel", "window.gUnifiedExtensions.togglePanel"), !0;
					}
					case "application-menu": {
						c();
						let t = u(n, "PanelUI-menu-button");
						if (d(t, "document.PanelUI-menu-button.focus"), !L(n.PanelUI)) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.show");
						return await l(n.PanelUI, "show", "window.PanelUI.show"), !0;
					}
					case "settings": return await l(n, "openPreferences", "window.openPreferences"), !0;
					case "customize":
						if (!L(n.gCustomizeMode)) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gCustomizeMode.enter");
						return await l(n.gCustomizeMode, "enter", "window.gCustomizeMode.enter"), !0;
					case "native-toolbar": {
						c();
						let t = B(n, "back-button");
						if (!L(t) || !R(t.focus)) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "document.back-button.focus");
						try {
							Reflect.apply(t.focus, t, [Object.freeze({ preventScroll: !0 })]);
						} catch (t) {
							throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.back-button.focus", t);
						}
						return !0;
					}
				}
				throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			} finally {
				--a;
			}
		},
		snapshot() {
			return pe(de(o()));
		}
	});
	return e.assertRequiredCapabilities(), s(), Object.freeze({
		assertRequiredCapabilities: s,
		browserTools: m,
		dispose() {
			return !i && (i = !0, r = null, !0);
		},
		snapshot() {
			return Object.freeze({
				disposed: i,
				pendingActionCount: a
			});
		}
	});
}
//#endregion
//#region src/firefox/downloads.ts
var he = "resource://gre/modules/Downloads.sys.mjs", ge = 3, _e = (e) => typeof e == "object" && !!e, ve = (e) => typeof e == "function", ye = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, U = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: ye(e),
	phase: n,
	symbol: r
}), be = (e) => typeof e == "number" && Number.isFinite(e) && Number.isSafeInteger(e) && e >= 0, xe = (e, t) => {
	if (!_e(t) || typeof t.stopped != "boolean" || typeof t.succeeded != "boolean" || typeof t.canceled != "boolean" || typeof t.hasPartialData != "boolean" || typeof t.hasProgress != "boolean" || !Number.isInteger(t.progress) || t.progress < 0 || t.progress > 100 || !be(t.currentBytes) || !be(t.totalBytes)) throw U(e, "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID", "firefox-downloads-event", "Download");
	return t;
}, Se = (e) => e.stopped ? e.succeeded ? "succeeded" : e.error ? "failed" : e.canceled ? e.hasPartialData ? "paused" : "canceled" : "queued" : "active", Ce = (e) => e === "succeeded" || e === "failed" || e === "canceled", we = (e) => Math.min(e, 999), Te = () => Object.freeze({
	activeCount: 0,
	aggregatePercent: null,
	canceledCount: 0,
	countOverflow: !1,
	failedCount: 0,
	items: Object.freeze([]),
	pausedCount: 0,
	phase: "loading",
	progressMode: "none",
	queuedCount: 0,
	revision: 0,
	succeededCount: 0,
	truncated: !1
});
function Ee({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !_e(r) || typeof t != "function" || typeof n != "function") throw U(e, "FENNEVIA_FIREFOX_DOWNLOADS_OPTIONS_INVALID", "firefox-downloads-create", "ChromeUtils.importESModule");
	let i;
	try {
		i = t(he);
	} catch (t) {
		throw U(e, "FENNEVIA_FIREFOX_DOWNLOADS_MODULE_LOAD_FAILED", "firefox-downloads-module-load", "ChromeUtils.importESModule", t);
	}
	let a = _e(i) ? i.Downloads : void 0, o = a, s = e.snapshot().windowKind === "private" ? "private" : "public", c = s === "private" ? o?.PRIVATE : o?.PUBLIC, l = Object.freeze([
		Object.freeze({
			isAvailable: _e,
			name: "firefox.downloads",
			read: () => a,
			symbol: "Downloads"
		}),
		Object.freeze({
			isAvailable: ve,
			name: "firefox.downloads-get-list",
			read: () => o?.getList,
			symbol: "Downloads.getList"
		}),
		Object.freeze({
			isAvailable: (e) => typeof e == "string",
			name: `firefox.downloads-${s}-list`,
			read: () => c,
			symbol: s === "private" ? "Downloads.PRIVATE" : "Downloads.PUBLIC"
		})
	]), u = r, d = null, f = !1, p = null, m = !0, h = 0, g = !1, v = !1, y = 0, x = 0, S = !1, C = Te(), w = "", T = new Set(), ee = e.createHandleRegistry("download"), E = new Map(), te = new WeakSet(), D = [], O = () => {
		if (f || !u) throw U(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSED", "firefox-downloads-access", "window");
		if (p) throw p;
		return e.assertOwnsWindow(u), u;
	}, ne = () => {
		let e = l.map((e) => {
			let t = !1, n;
			try {
				t = e.isAvailable(e.read());
			} catch (e) {
				n = e;
			}
			return Object.freeze({
				...n === void 0 ? {} : { cause: n },
				snapshot: Object.freeze({
					available: t,
					name: e.name,
					requirement: "required",
					symbol: e.symbol
				})
			});
		});
		return d && e.push(Object.freeze({ snapshot: Object.freeze({
			available: ve(d.addView),
			name: "firefox.downloads-list-add-view",
			requirement: "required",
			symbol: "DownloadList.addView"
		}) }), Object.freeze({ snapshot: Object.freeze({
			available: ve(d.removeView),
			name: "firefox.downloads-list-remove-view",
			requirement: "required",
			symbol: "DownloadList.removeView"
		}) })), Object.freeze(e);
	}, k = () => {
		O();
		let t = ne(), n = t.find((e) => !e.snapshot.available);
		if (n) throw U(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, A = (t) => p || (p = _(t) ? t : U(e, "FENNEVIA_FIREFOX_DOWNLOADS_EVENT_FAILED", "firefox-downloads-event", "DownloadList.view", t), n(p), p), j = (e) => {
		let t = E.get(e);
		if (!t) return !1;
		E.delete(e);
		let n = D.indexOf(e);
		return n !== -1 && D.splice(n, 1), ee.release(t.id), !0;
	}, M = (e) => {
		let t = D.indexOf(e);
		for (t !== -1 && D.splice(t, 1), D.unshift(e); D.length > ge;) {
			let e = D.pop();
			e && j(e);
		}
	}, N = (t) => {
		let n = xe(e, t), r = Se(n);
		if (m && (te.add(n), Ce(r))) return;
		let i = E.get(n);
		if (!(!i && Ce(r) && te.has(n))) {
			if (i || (i = {
				currentBytes: 0,
				download: n,
				hasProgress: !1,
				id: ee.register(n),
				order: ++x,
				progressPercent: null,
				state: r,
				totalBytes: 0
			}, E.set(n, i)), i.currentBytes = n.currentBytes, i.hasProgress = n.hasProgress, i.progressPercent = r === "succeeded" ? 100 : n.hasProgress ? n.progress : null, i.state = r, i.totalBytes = n.totalBytes, Ce(r)) M(n);
			else {
				let e = D.indexOf(n);
				e !== -1 && D.splice(e, 1);
			}
		}
	}, P = (e) => {
		if (e.length === 0) return Object.freeze({
			mode: "none",
			percent: null
		});
		if (e.some((e) => !e.hasProgress)) return Object.freeze({
			mode: "indeterminate",
			percent: null
		});
		let t = 0, n = 0, r = 0, i = 0;
		for (let a of e) a.totalBytes > 0 ? (n += a.totalBytes, t += Math.min(a.currentBytes, a.totalBytes)) : (r += a.progressPercent ?? 0, i += 1);
		let a = n > 0 ? t / n * 100 : i > 0 ? r / i : 0;
		return Object.freeze({
			mode: "determinate",
			percent: Math.max(0, Math.min(100, Math.floor(a)))
		});
	}, F = () => {
		let e = {
			active: [],
			canceled: [],
			failed: [],
			paused: [],
			queued: [],
			succeeded: []
		};
		for (let t of E.values()) e[t.state].push(t);
		for (let t of [
			"active",
			"paused",
			"queued"
		]) e[t].sort((e, t) => e.order - t.order);
		let t = D.map((e) => E.get(e)).filter((e) => !!e), n = [
			...e.active,
			...e.paused,
			...e.queued,
			...t
		], r = n.slice(0, 6).map((e) => Object.freeze({
			id: e.id,
			progressPercent: e.progressPercent,
			state: e.state
		})), i = P(e.active), a = Object.freeze({
			active: e.active.length,
			canceled: e.canceled.length,
			failed: e.failed.length,
			paused: e.paused.length,
			queued: e.queued.length,
			succeeded: e.succeeded.length
		}), o = Object.values(a).some((e) => e > 999);
		return Object.freeze({
			activeCount: we(a.active),
			aggregatePercent: i.percent,
			canceledCount: we(a.canceled),
			countOverflow: o,
			failedCount: we(a.failed),
			items: Object.freeze(r),
			pausedCount: we(a.paused),
			phase: v ? "ready" : "loading",
			progressMode: i.mode,
			queuedCount: we(a.queued),
			revision: y + 1,
			succeededCount: we(a.succeeded),
			truncated: n.length > 6 || o
		});
	}, I = () => {
		if (f || p || m || h > 0) {
			g = !0;
			return;
		}
		g = !1;
		let t = F(), n = JSON.stringify({
			...t,
			revision: 0
		});
		if (n !== w) {
			w = n, y += 1, C = Object.freeze({
				...t,
				revision: y
			});
			for (let t of Array.from(T)) try {
				t(C);
			} catch (t) {
				A(U(e, "FENNEVIA_FIREFOX_DOWNLOADS_SUBSCRIBER_FAILED", "firefox-downloads-notify", "downloads.subscribe", t));
				return;
			}
		}
	}, re = Object.freeze({
		onDownloadAdded(e) {
			if (!(f || p)) try {
				N(e), I();
			} catch (e) {
				A(e);
			}
		},
		onDownloadBatchEnded() {
			f || p || (h > 0 && --h, h === 0 && g && I());
		},
		onDownloadBatchStarting() {
			!f && !p && (h += 1);
		},
		onDownloadChanged(e) {
			if (!(f || p)) try {
				N(e), I();
			} catch (e) {
				A(e);
			}
		},
		onDownloadRemoved(t) {
			if (!(f || p)) try {
				let n = xe(e, t);
				j(n), I();
			} catch (e) {
				A(e);
			}
		}
	}), ie = b(() => {
		!S || !d || (S = !1, Reflect.apply(d.removeView, d, [re]));
	});
	e.assertRequiredCapabilities(), k();
	let ae = (async () => {
		try {
			let t = await Reflect.apply(o.getList, o, [c]);
			if (f) return !0;
			if (!_e(t) || !ve(t.addView) || !ve(t.removeView)) throw U(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", !_e(t) || !ve(t.addView) ? "DownloadList.addView" : "DownloadList.removeView");
			if (d = t, S = !0, Reflect.apply(d.addView, d, [re]), f) return ie(), !0;
			if (m = !1, h = 0, p) throw p;
			return v = !0, I(), !0;
		} catch (t) {
			if (f) return !0;
			throw p ?? A(_(t) ? t : U(e, "FENNEVIA_FIREFOX_DOWNLOADS_INITIALIZATION_FAILED", "firefox-downloads-initialize", "Downloads.getList", t));
		}
	})();
	ae.catch(() => void 0);
	let oe = Object.freeze({
		ready() {
			return O(), ae;
		},
		snapshot() {
			return O(), C;
		},
		subscribe(t) {
			if (O(), typeof t != "function") throw U(e, "FENNEVIA_FIREFOX_DOWNLOADS_LISTENER_INVALID", "firefox-downloads-subscribe", "downloads.subscribe");
			return T.add(t), b(() => {
				T.delete(t);
			});
		}
	});
	return Object.freeze({
		assertRequiredCapabilities: k,
		dispose() {
			if (f) return !1;
			f = !0, u = null, m = !1, h = 0, g = !1;
			let t;
			try {
				ie();
			} catch (e) {
				t = e;
			}
			T.clear(), E.clear(), D.length = 0;
			try {
				ee.dispose();
			} catch (e) {
				t ??= e;
			}
			if (d = null, t !== void 0) throw U(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSE_FAILED", "firefox-downloads-dispose", "DownloadList.removeView", t);
			return !0;
		},
		downloads: oe,
		ready() {
			return O(), ae;
		},
		snapshot() {
			return Object.freeze({
				disposed: f,
				failed: p !== null,
				handleCount: ee.snapshot().activeHandleCount,
				listKind: s,
				ready: v,
				revision: y,
				subscriberCount: T.size,
				viewRegistered: S
			});
		}
	});
}
//#endregion
//#region src/app/navigation-state.ts
var De = 2048, Oe = 4096, W = Object.freeze({
	back: Object.freeze({
		id: "Browser:Back",
		method: "back"
	}),
	forward: Object.freeze({
		id: "Browser:Forward",
		method: "forward"
	}),
	newTab: Object.freeze({
		id: "cmd_newNavigatorTabNoEvent",
		method: "openTab"
	}),
	reload: Object.freeze({
		id: "Browser:Reload",
		method: "reload"
	}),
	stop: Object.freeze({
		id: "Browser:Stop",
		method: "stop"
	})
}), ke = Object.freeze(["TabSelect", "TabAttrModified"]), Ae = new Set([
	"busy",
	"label",
	"selected"
]), je = "Browser:OpenLocation", Me = "focusURLBar", Ne = "data-fennevia-healthy", Pe = Object.freeze({
	selectAll: !0,
	source: "ctrl-l",
	type: "address-popup-open"
}), Fe = Object.freeze({ status: "accepted" }), Ie = Object.freeze({
	reason: "empty",
	status: "rejected"
}), Le = Object.freeze({
	reason: "too-long",
	status: "rejected"
}), Re = Object.freeze({
	reason: "unsafe-scheme",
	status: "rejected"
}), ze = /^\s*(?:data|javascript|vbscript)\s*:/iu, Be = new Set([
	"about:blank",
	"about:home",
	"about:newtab",
	"about:privatebrowsing"
]), Ve = Object.freeze({
	associated: "associated",
	"cert-error-page": "certificate-error",
	chrome: "internal",
	extension: "extension",
	file: "local",
	"https-only-error-page": "https-only-error",
	"net-error-page": "network-error",
	"not-secure": "not-secure",
	secure: "secure",
	"secure-cert-user-overridden": "secure-certificate-override",
	"secure-etsi": "secure-qualified-certificate",
	"secure-ev": "secure-verified-organization"
}), He = (e) => `document.commands[${e.replaceAll(":", "-")}]`, G = (e) => typeof e == "object" && !!e, K = (e) => typeof e == "function", Ue = (e) => G(e) && K(e.addEventListener) && K(e.removeEventListener), We = (e) => e.gBrowser, Ge = (e, t) => {
	let n = We(e);
	return G(n) ? n[t] : void 0;
}, Ke = (e, t) => {
	let n = Ge(e, "selectedBrowser");
	return G(n) ? n[t] : void 0;
}, qe = (e, t) => {
	let n = e.BrowserCommands;
	return G(n) ? n[t] : void 0;
}, Je = (e, t) => {
	let n = e.gURLBar;
	return G(n) ? n[t] : void 0;
}, Ye = (e, t) => e[t], Xe = (e) => {
	let t = e.document;
	return G(t) ? t.documentElement : void 0;
}, Ze = (e, t) => {
	let n = e.document;
	if (!(!G(n) || !K(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Qe = (e) => G(e) && K(e.hasAttribute), $e = (e) => Ue(e) && typeof e.value == "string" && K(e.getAttribute) && K(e.handleCommand), et = (e) => G(e) && K(e.getConnectionSecurityInformation), tt = (e) => G(e) && K(e.onContentBlockingEvent), nt = (e) => G(e) && K(e.canHandle), rt = (e) => G(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", it = (e) => G(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), at = Object.freeze([
	Object.freeze({
		isAvailable: rt,
		name: "firefox.navigation-selected-browser",
		read: (e) => Ge(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: it,
		name: "firefox.navigation-current-uri",
		read: (e) => Ke(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: K,
		name: "firefox.navigation-selected-browser-focus",
		read: (e) => Ke(e, "focus"),
		symbol: "window.gBrowser.selectedBrowser.focus"
	}),
	Object.freeze({
		isAvailable: (e) => G(e) && K(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => Ge(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: Ue,
		name: "firefox.navigation-tab-events",
		read: (e) => Ge(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: K,
		name: `firefox.navigation-${e}`,
		read: (e) => Ge(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: K,
		name: "firefox.navigation-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: (e) => typeof e == "string",
		name: "firefox.navigation-urlbar-value",
		read: (e) => Je(e, "value"),
		symbol: "window.gURLBar.value"
	}),
	Object.freeze({
		isAvailable: K,
		name: "firefox.navigation-urlbar-submission",
		read: (e) => Je(e, "handleCommand"),
		symbol: "window.gURLBar.handleCommand"
	}),
	Object.freeze({
		isAvailable: K,
		name: "firefox.navigation-urlbar-proxy-state",
		read: (e) => Je(e, "getAttribute"),
		symbol: "window.gURLBar.getAttribute"
	}),
	Object.freeze({
		isAvailable: et,
		name: "firefox.navigation-connection-security",
		read: (e) => Ye(e, "gIdentityHandler"),
		symbol: "window.gIdentityHandler.getConnectionSecurityInformation"
	}),
	Object.freeze({
		isAvailable: tt,
		name: "firefox.navigation-tracking-protection",
		read: (e) => Ye(e, "gProtectionsHandler"),
		symbol: "window.gProtectionsHandler.onContentBlockingEvent"
	}),
	Object.freeze({
		isAvailable: nt,
		name: "firefox.navigation-tracking-protection-availability",
		read: (e) => Ye(e, "ContentBlockingAllowList"),
		symbol: "window.ContentBlockingAllowList.canHandle"
	}),
	Object.freeze({
		isAvailable: (e) => Qe(e) && Ue(e),
		name: "firefox.navigation-open-location-command",
		read: (e) => Ze(e, je),
		symbol: He(je)
	}),
	Object.freeze({
		isAvailable: (e) => G(e) && K(e.hasAttribute),
		name: "firefox.navigation-shell-health-gate",
		read: Xe,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Object.values(W).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: Qe,
		name: `firefox.navigation-command-${t}`,
		read: (t) => Ze(t, e),
		symbol: He(e)
	}), Object.freeze({
		isAvailable: K,
		name: `firefox.navigation-action-${t}`,
		read: (e) => qe(e, t),
		symbol: `window.BrowserCommands.${t}`
	})])
]), ot = (e) => Object.freeze(at.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: "required",
			symbol: t.symbol
		})
	});
})), st = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, q = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: st(e),
	phase: n,
	symbol: r
}), ct = (e, t) => e.addressValue === t.addressValue && e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.connectionSecurity === t.connectionSecurity && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title && e.trackingProtection === t.trackingProtection, lt = (e) => {
	if (!G(e) || !G(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Ae.has(e));
};
function ut({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !G(n) || typeof t != "function") throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID", "firefox-navigation-create", "window");
	let r = n, i = !1, a = null, o = 0, s = Object.freeze({
		addressValue: "",
		canGoBack: !1,
		canGoForward: !1,
		connectionSecurity: "unavailable",
		displayUri: "",
		loading: !1,
		title: "",
		trackingProtection: "unavailable"
	}), c = null, l = !1, u = [], d = new Set(), f = new Set(), p = () => {
		if (i || !r) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSED", "firefox-navigation-access", "window.gBrowser.selectedBrowser");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, m = () => {
		let t = p().gBrowser;
		if (!G(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gBrowser");
		return t;
	}, h = () => {
		let t = m().selectedBrowser;
		if (!rt(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, g = () => {
		let t = m().selectedTab;
		if (!G(t) || !K(t.getAttribute)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, v = (t) => {
		let n = Ze(p(), t);
		if (!Qe(n)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", He(t));
		return n;
	}, y = () => {
		let t = p().gURLBar;
		if (!$e(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gURLBar.handleCommand");
		return t;
	}, x = () => {
		let t = p().gIdentityHandler;
		if (!et(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gIdentityHandler.getConnectionSecurityInformation");
		return t;
	}, S = () => {
		let t = p().gProtectionsHandler;
		if (!tt(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gProtectionsHandler.onContentBlockingEvent");
		return t;
	}, C = () => {
		let t = p().ContentBlockingAllowList;
		if (!nt(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.ContentBlockingAllowList.canHandle");
		return t;
	}, w = () => {
		let t = ot(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (e) => {
		let t = v(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, ee = (t) => {
		let n = t.currentURI;
		if (!it(n)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, De);
	}, E = (e) => {
		if (Be.has(e)) return "";
		let t = y();
		return (Reflect.apply(t.getAttribute, t, ["pageproxystate"]) === "valid" ? t.value : e).slice(0, Oe);
	}, te = () => {
		let e = x(), t = Reflect.apply(e.getConnectionSecurityInformation, e, []);
		return typeof t == "string" ? Ve[t] ?? "unavailable" : "unavailable";
	}, D = (e) => {
		let t = C();
		if (Reflect.apply(t.canHandle, t, [e]) !== !0) return "unavailable";
		let n = S();
		return typeof n.hasException != "boolean" || typeof n.anyBlocking != "boolean" || typeof n.anyDetected != "boolean" ? "unavailable" : n.hasException ? "exception" : n.anyBlocking ? "blocking" : n.anyDetected ? "detected" : "no-trackers-detected";
	}, O = () => {
		let e = h(), t = g(), n = ee(e);
		return Object.freeze({
			addressValue: E(n),
			canGoBack: T(W.back.id),
			canGoForward: T(W.forward.id),
			connectionSecurity: te(),
			displayUri: n,
			loading: T(W.stop.id),
			title: String(Reflect.apply(t.getAttribute, t, ["label"]) ?? "").slice(0, 256),
			trackingProtection: D(e)
		});
	}, ne = () => {
		let n = Object.freeze({
			revision: o,
			snapshot: s,
			type: "snapshot"
		});
		for (let r of Array.from(d)) try {
			r(n);
		} catch (n) {
			t(q(e, "FENNEVIA_FIREFOX_NAVIGATION_SUBSCRIBER_FAILED", "firefox-navigation-notify", "navigation.subscribe", n));
		}
	}, k = (e) => {
		let t = O();
		return ct(s, t) && o > 0 ? !1 : (s = t, o += 1, e && ne(), !0);
	}, A = (n, r) => {
		a = _(n) ? n : q(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, j = (e) => {
		if (!(i || a)) try {
			k(!0);
		} catch (t) {
			A(t, e);
		}
	}, M = (e, t, n) => {
		if (!(i || a)) try {
			e === m().selectedBrowser && G(t) && t.isTopLevel === !0 && k(!0);
		} catch (e) {
			A(e, n);
		}
	}, N = Object.freeze({
		onLocationChange(e, t) {
			M(e, t, "window.gBrowser.onLocationChange");
		},
		onStateChange(e, t) {
			M(e, t, "window.gBrowser.onStateChange");
		},
		onSecurityChange(e, t) {
			M(e, t, "window.gBrowser.onSecurityChange");
		},
		onContentBlockingEvent(e, t) {
			M(e, t, "window.gBrowser.onContentBlockingEvent");
		}
	}), P = (t, n = !0) => {
		let r = W[t];
		h();
		let i = v(r.id);
		if (n && Reflect.apply(i.hasAttribute, i, ["disabled"])) return !1;
		let a = p().BrowserCommands, o = G(a) ? a[r.method] : void 0;
		if (!K(o)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${r.method}`);
		try {
			return Reflect.apply(o, a, []), !0;
		} catch (t) {
			throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${r.method}`, t);
		}
	}, F = (t) => {
		if (typeof t != "string") return Ie;
		if (t.length > 4096) return Le;
		if (t.trim().length === 0) return Ie;
		if (ze.test(t)) return Re;
		h();
		let n = y();
		try {
			return n.value = t, Reflect.apply(n.handleCommand, n, []), Fe;
		} catch (t) {
			throw q(e, "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED", "firefox-address-submit", "window.gURLBar.handleCommand", t);
		}
	}, I = () => {
		let e = Xe(p());
		return G(e) && K(e.hasAttribute) && !!Reflect.apply(e.hasAttribute, e, [Ne]);
	}, re = (e) => {
		if (!G(e) || !G(e.sourceEvent)) return !1;
		let t = e.sourceEvent.target;
		return G(t) && t.id === Me;
	}, ie = (e) => {
		if (!(i || a)) try {
			if (!I() || !re(e) || f.size === 0) return;
			k(!0);
			let t = !1;
			for (let e of Array.from(f)) t = e(Pe) === !0 || t;
			if (!t || !G(e)) return;
			K(e.preventDefault) && Reflect.apply(e.preventDefault, e, []), K(e.stopPropagation) && Reflect.apply(e.stopPropagation, e, []);
		} catch (e) {
			A(e, He(je));
		}
	}, ae = Object.freeze({
		back: () => P("back"),
		focusContent() {
			let t = h(), n = t.focus;
			if (!K(n)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus");
			try {
				return Reflect.apply(n, t, []), !0;
			} catch (t) {
				throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus", t);
			}
		},
		forward: () => P("forward"),
		newTab: () => P("newTab", !1),
		reload: () => P("reload"),
		reloadOrStop() {
			let e = T(W.stop.id) ? "stop" : "reload";
			return P(e), e;
		},
		snapshot() {
			return p(), s;
		},
		stop: () => P("stop"),
		submitAddress: F,
		subscribe(t) {
			if (p(), typeof t != "function") throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_LISTENER_INVALID", "firefox-navigation-subscribe", "navigation.subscribe");
			return d.add(t), b(() => {
				d.delete(t);
			});
		},
		subscribeAddressPopupOpen(t) {
			if (p(), typeof t != "function") throw q(e, "FENNEVIA_FIREFOX_ADDRESS_POPUP_LISTENER_INVALID", "firefox-address-popup-subscribe", "navigation.subscribeAddressPopupOpen");
			return f.add(t), b(() => {
				f.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), k(!1);
		let t = m().tabContainer;
		for (let n of ke) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (G(e) && e.target !== m().selectedTab || !lt(e))) return;
				k(!0);
			} catch (e) {
				A(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		u.push(e.subscribe(v(je), "command", ie));
		let n = m();
		Reflect.apply(n.addTabsProgressListener, n, [N]), l = !0;
		let r = p().MutationObserver;
		c = new r(() => {
			j("document.command.disabled");
		});
		for (let { id: e } of Object.values(W)) c.observe(v(e), {
			attributeFilter: ["disabled"],
			attributes: !0
		});
	} catch (n) {
		i = !0;
		let a;
		try {
			c?.disconnect();
		} catch (e) {
			a ??= e;
		}
		if (c = null, l && r) try {
			let e = G(r.gBrowser) ? r.gBrowser : null;
			e && K(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [N]);
		} catch (e) {
			a ??= e;
		}
		l = !1;
		for (let e of u.reverse()) try {
			e();
		} catch (e) {
			a ??= e;
		}
		throw r = null, a !== void 0 && t(q(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", a)), n;
	}
	return Object.freeze({
		assertRequiredCapabilities: w,
		dispose() {
			if (i) return !1;
			i = !0;
			let t;
			try {
				c?.disconnect();
			} catch (e) {
				t ??= e;
			}
			if (c = null, l && r) try {
				let e = G(r.gBrowser) ? r.gBrowser : null;
				if (!e || !K(e.removeTabsProgressListener)) throw TypeError("FENNEVIA_FIREFOX_NAVIGATION_PROGRESS_DISPOSER_INVALID");
				Reflect.apply(e.removeTabsProgressListener, e, [N]);
			} catch (e) {
				t ??= e;
			}
			l = !1;
			for (let e of u.reverse()) try {
				e();
			} catch (e) {
				t ??= e;
			}
			if (u.length = 0, d.clear(), f.clear(), r = null, t !== void 0) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", t);
			return !0;
		},
		navigation: ae,
		snapshot() {
			return Object.freeze({
				addressPopupSubscriberCount: f.size,
				disposed: i,
				failed: a !== null,
				revision: o,
				subscriberCount: d.size
			});
		}
	});
}
//#endregion
//#region src/firefox/tabs.ts
var dt = Object.freeze([
	"TabOpen",
	"TabClose",
	"TabSelect",
	"TabMove",
	"TabPinned",
	"TabUnpinned",
	"TabAttrModified"
]), ft = new Set([
	"busy",
	"image",
	"label",
	"selected"
]), pt = 262144, mt = /[\s"'<>\\]/u, ht = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, gt = (e) => typeof e == "object" && !!e || typeof e == "function", J = (e) => typeof e == "object" && !!e, _t = (e) => typeof e == "function", vt = (e) => e.gBrowser, yt = (e, t) => {
	let n = vt(e);
	return J(n) ? n[t] : void 0;
}, bt = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => yt(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: gt,
		name: "firefox.selected-tab",
		read: (e) => yt(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab"
	}),
	...[
		["add-tab", "addTrustedTab"],
		["remove-tab", "removeTab"],
		["pin-tab", "pinTab"],
		["unpin-tab", "unpinTab"]
	].map(([e, t]) => Object.freeze({
		isAvailable: _t,
		name: `firefox.${e}`,
		read: (e) => yt(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: (e) => typeof e == "string" && e.length > 0 && e.length <= 2048,
		name: "firefox.new-tab-url",
		read: (e) => e.BROWSER_NEW_TAB_URL,
		symbol: "window.BROWSER_NEW_TAB_URL"
	})
]), xt = (e) => Object.freeze(bt.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: "required",
			symbol: t.symbol
		})
	});
})), St = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Y = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: St(e),
	phase: n,
	symbol: r
}), Ct = (e, t) => {
	if (!J(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw Y(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, wt = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !mt.test(e) || e.length <= pt && ht.test(e))) return e;
}, Tt = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl;
}), Et = (e) => {
	if (!J(e) || !J(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => ft.has(e));
};
function Dt({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !J(n) || typeof t != "function") throw Y(e, "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID", "firefox-tabs-create", "window");
	let r = n, i = !1, a = null, o = 0, s = Object.freeze([]), c = new Set(), l = new Set(), u = [], d = e.createHandleRegistry("tab"), f = () => {
		if (i || !r) throw Y(e, "FENNEVIA_FIREFOX_TABS_DISPOSED", "firefox-tabs-access", "window.gBrowser.openTabs");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, p = () => {
		let t = f().gBrowser;
		if (!J(t)) throw Y(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "window.gBrowser");
		return t;
	}, m = () => {
		let t = xt(f()), n = t.find((e) => !e.snapshot.available);
		if (n) throw Y(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, h = () => {
		let t = p().openTabs;
		if (!Array.isArray(t)) throw Y(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = t.map((t) => Ct(e, t));
		if (new Set(n).size !== n.length) throw Y(e, "FENNEVIA_FIREFOX_TAB_ORDER_INVALID", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		return n;
	}, g = (e, t) => Reflect.apply(e.getAttribute, e, [t]), v = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), y = (e, t) => {
		let n = String(g(e, "label") ?? "").slice(0, 256), r = wt(g(e, "image"));
		return Object.freeze({
			...r === void 0 ? {} : { faviconUrl: r },
			id: d.register(e),
			loading: v(e, "busy"),
			pinned: v(e, "pinned"),
			selected: t === e,
			title: n
		});
	}, x = () => {
		let n = Object.freeze({
			revision: o,
			tabs: s,
			type: "snapshot"
		});
		for (let r of Array.from(l)) try {
			r(n);
		} catch (n) {
			t(Y(e, "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED", "firefox-tabs-notify", "tabs.subscribe", n));
		}
	}, S = (e) => {
		let t = p(), n = h().map((e) => y(e, t.selectedTab)), r = new Set(n.map((e) => e.id));
		for (let e of Array.from(c)) r.has(e) || (d.release(e), c.delete(e));
		for (let e of r) c.add(e);
		let i = Object.freeze(n);
		return !Tt(s, i) && (s = i, o += 1, e && x(), !0);
	}, C = (n, r) => {
		a = _(n) ? n : Y(e, "FENNEVIA_FIREFOX_TABS_EVENT_FAILED", "firefox-tabs-event", `window.gBrowser.tabContainer.${r}`, n), t(a);
	}, w = (t) => {
		f();
		let n = d.resolve(t);
		if (!h().includes(n)) throw d.release(t), c.delete(t), Y(e, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-action", "tab.opaque-id");
		return n;
	}, T = (t, n) => {
		let r = p(), i = r[t];
		if (typeof i != "function") throw Y(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", `window.gBrowser.${t}`);
		return Reflect.apply(i, r, n);
	}, ee = (t) => {
		if (t === void 0) return Object.freeze({ selected: !0 });
		if (!J(t) || Object.keys(t).some((e) => e !== "selected") || t.selected !== void 0 && typeof t.selected != "boolean") throw Y(e, "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID", "firefox-tabs-action", "tabs.open.options");
		return Object.freeze({ selected: t.selected ?? !0 });
	}, E = Object.freeze({
		close(e) {
			let t = w(e);
			T("removeTab", [t, {
				animate: !0,
				isUserTriggered: !0
			}]), S(!0);
		},
		open(t) {
			let n = ee(t), r = f().BROWSER_NEW_TAB_URL;
			if (typeof r != "string" || r.length === 0) throw Y(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.BROWSER_NEW_TAB_URL");
			let i = Ct(e, T("addTrustedTab", [r, { inBackground: !n.selected }]));
			if (!h().includes(i)) throw Y(e, "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED", "firefox-tabs-action", "window.gBrowser.addTrustedTab");
			let a = d.register(i);
			if (S(!0), n.selected && p().selectedTab !== i) throw Y(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			return a;
		},
		pin(t) {
			let n = w(t);
			if (!v(n, "pinned")) {
				if (T("pinTab", [n]), !v(n, "pinned")) throw Y(e, "FENNEVIA_FIREFOX_TAB_PIN_REJECTED", "firefox-tabs-action", "window.gBrowser.pinTab");
				S(!0);
			}
		},
		select(t) {
			let n = w(t), r = p();
			if (r.selectedTab !== n) {
				if (!Reflect.set(r, "selectedTab", n) || r.selectedTab !== n) throw Y(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
				S(!0);
			}
		},
		snapshot() {
			return f(), s;
		},
		subscribe(t) {
			if (f(), typeof t != "function") throw Y(e, "FENNEVIA_FIREFOX_TABS_LISTENER_INVALID", "firefox-tabs-subscribe", "tabs.subscribe");
			return l.add(t), b(() => {
				l.delete(t);
			});
		},
		unpin(t) {
			let n = w(t);
			if (v(n, "pinned")) {
				if (T("unpinTab", [n]), v(n, "pinned")) throw Y(e, "FENNEVIA_FIREFOX_TAB_UNPIN_REJECTED", "firefox-tabs-action", "window.gBrowser.unpinTab");
				S(!0);
			}
		}
	});
	try {
		e.assertRequiredCapabilities(), m(), S(!1);
		let t = p().tabContainer;
		for (let n of dt) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && !Et(e)) return;
				S(!0);
			} catch (e) {
				C(e, n);
			}
		}));
	} catch (n) {
		i = !0, r = null;
		let a;
		for (let e of u.reverse()) try {
			e();
		} catch (e) {
			a ??= e;
		}
		try {
			d.dispose();
		} catch (e) {
			a ??= e;
		}
		throw a !== void 0 && t(Y(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", a)), n;
	}
	return Object.freeze({
		assertRequiredCapabilities: m,
		dispose() {
			if (i) return !1;
			i = !0, r = null;
			let t;
			for (let e of u.reverse()) try {
				e();
			} catch (e) {
				t ??= e;
			}
			u.length = 0, l.clear(), c.clear(), s = Object.freeze([]);
			try {
				d.dispose();
			} catch (e) {
				t ??= e;
			}
			if (t !== void 0) throw Y(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", t);
			return !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: i,
				failed: a !== null,
				revision: o,
				subscriberCount: l.size,
				tabCount: s.length
			});
		},
		tabs: E
	});
}
//#endregion
//#region src/app/urlbar-coverage-state.ts
var Ot = Object.freeze([
	"autoplay",
	"camera",
	"canvas",
	"install",
	"local-network",
	"location",
	"loopback-network",
	"microphone",
	"midi",
	"notifications",
	"persistent-storage",
	"popups",
	"screen",
	"serial",
	"xr"
]), kt = Object.freeze([
	"location",
	"media",
	"serial",
	"xr"
]), At = Object.freeze([
	"remote-control",
	"search-mode",
	"persisted-search",
	"recommendation",
	"container",
	"reader-view",
	"picture-in-picture",
	"taskbar-tabs",
	"translations",
	"zoom",
	"split-view",
	"bookmark",
	"extension-actions",
	"other-page-actions",
	"more-page-actions"
]);
new Set(Ot), new Set(kt), new Set(At);
//#endregion
//#region src/firefox/urlbar-coverage.ts
var jt = Object.freeze([
	"blocked-permissions-container",
	"identity-permission-box",
	"page-action-buttons"
]), Mt = Object.freeze({
	"autoplay-media": "autoplay",
	camera: "camera",
	canvas: "canvas",
	install: "install",
	"local-network": "local-network",
	geo: "location",
	"loopback-network": "loopback-network",
	microphone: "microphone",
	midi: "midi",
	"desktop-notification": "notifications",
	"persistent-storage": "persistent-storage",
	popup: "popups",
	screen: "screen",
	serial: "serial",
	xr: "xr"
}), Nt = Object.freeze([
	Object.freeze({
		id: "geo-sharing-icon",
		kind: "location"
	}),
	Object.freeze({
		id: "webrtc-sharing-icon",
		kind: "media"
	}),
	Object.freeze({
		id: "serial-sharing-icon",
		kind: "serial"
	}),
	Object.freeze({
		id: "xr-sharing-icon",
		kind: "xr"
	})
]), Pt = Object.freeze([
	Object.freeze({
		id: "contextual-feature-recommendation",
		kind: "recommendation"
	}),
	Object.freeze({
		id: "userContext-icons",
		kind: "container"
	}),
	Object.freeze({
		id: "reader-mode-button",
		kind: "reader-view"
	}),
	Object.freeze({
		id: "picture-in-picture-button",
		kind: "picture-in-picture"
	}),
	Object.freeze({
		id: "taskbar-tabs-button",
		kind: "taskbar-tabs"
	}),
	Object.freeze({
		id: "translations-button",
		kind: "translations"
	}),
	Object.freeze({
		id: "urlbar-zoom-button",
		kind: "zoom"
	}),
	Object.freeze({
		id: "split-view-button",
		kind: "split-view"
	}),
	Object.freeze({
		id: "star-button-box",
		kind: "bookmark"
	})
]), Ft = new Set([
	"contextual-feature-recommendation",
	"pageActionButton",
	"picture-in-picture-button",
	"reader-mode-button",
	"split-view-button",
	"star-button-box",
	"taskbar-tabs-button",
	"translations-button",
	"urlbar-zoom-button",
	"userContext-icons"
]), It = (e) => typeof e == "object" && !!e, X = (e) => typeof e == "function", Z = (e) => It(e) && X(e.getAttribute) && X(e.hasAttribute), Lt = (e) => It(e) && X(e.getElementById), Rt = (e) => Lt(e.document) ? e.document : null, zt = (e, t) => {
	let n = Rt(e);
	return n ? Reflect.apply(n.getElementById, n, [t]) : void 0;
}, Bt = (e) => Rt(e)?.documentElement, Vt = Object.freeze([
	Object.freeze({
		isAvailable: X,
		name: "firefox.urlbar-coverage-native-access",
		read: (e) => e.openLocation,
		symbol: "window.openLocation"
	}),
	Object.freeze({
		isAvailable: X,
		name: "firefox.urlbar-coverage-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: Z,
		name: "firefox.urlbar-coverage-urlbar-state",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.hasAttribute"
	}),
	Object.freeze({
		isAvailable: Z,
		name: "firefox.urlbar-coverage-window-state",
		read: Bt,
		symbol: "document.documentElement.hasAttribute"
	}),
	...jt.map((e) => Object.freeze({
		isAvailable: Z,
		name: `firefox.urlbar-coverage-${e}`,
		read: (t) => zt(t, e),
		symbol: `document.elements[${e}]`
	}))
]), Ht = (e, t) => Object.freeze([...Vt.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: "required",
			symbol: t.symbol
		})
	});
}), Object.freeze({ snapshot: Object.freeze({
	available: X(t),
	name: "firefox.urlbar-coverage-native-ui-handoff",
	requirement: "required",
	symbol: "nativeUi.revealForUrlbar"
}) })]), Ut = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Q = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Ut(e),
	phase: n,
	symbol: r
}), Wt = (e, t) => {
	let n = Reflect.apply(e.getAttribute, e, [t]);
	return typeof n == "string" ? n : null;
}, $ = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), Gt = (e) => {
	if (e.hidden === !0) return !1;
	let t = Wt(e, "hidden");
	return t !== null && t !== "false" ? !1 : Wt(e, "collapsed") !== "true";
}, Kt = (e) => {
	let t = e.children;
	return Object.freeze(!t || typeof t != "object" && !Array.isArray(t) ? [] : Array.from(t));
}, qt = (e, t) => {
	let n = e.classList;
	return It(n) && X(n.contains) && !!Reflect.apply(n.contains, n, [t]);
}, Jt = (e, t) => e.permissions.available === t.permissions.available && e.permissions.hasPermissions === t.permissions.hasPermissions && e.permissions.blocked.length === t.permissions.blocked.length && e.permissions.blocked.every((e, n) => e === t.permissions.blocked[n]) && e.permissions.sharing.length === t.permissions.sharing.length && e.permissions.sharing.every((e, n) => e === t.permissions.sharing[n]) && e.items.length === t.items.length && e.items.every((e, n) => e === t.items[n]);
function Yt({ boundary: e, onError: t, requestNativeUiReveal: n, window: r }) {
	if (e.assertOwnsWindow(r), !It(r) || typeof t != "function" || typeof n != "function") throw Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_OPTIONS_INVALID", "firefox-urlbar-coverage-create", "window");
	let i = r, a = !1, o = null, s = 0, c = null, l = Object.freeze({
		items: Object.freeze([]),
		permissions: Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		})
	}), u = new Set(), d = () => {
		if (a || !i) throw Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSED", "firefox-urlbar-coverage-access", "window.gURLBar");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, f = (t) => {
		let n = zt(d(), t);
		if (!Z(n)) throw Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", `document.elements[${t}]`);
		return n;
	}, p = () => {
		let t = d().gURLBar;
		if (!Z(t)) throw Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "window.gURLBar.hasAttribute");
		return t;
	}, m = () => {
		let t = Bt(d());
		if (!Z(t)) throw Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "document.documentElement.hasAttribute");
		return t;
	}, h = () => {
		let t = Ht(d(), n), r = t.find((e) => !e.snapshot.available);
		if (r) throw Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-capability", r.snapshot.symbol, r.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, g = () => {
		let e = p(), t = f("identity-permission-box"), n = Object.freeze(Nt.flatMap(({ id: e, kind: t }) => {
			let n = zt(d(), e);
			return Z(n) && $(n, "sharing") ? [t] : [];
		}));
		if (!(Wt(e, "pageproxystate") === "valid" || $(e, "persistsearchterms") || n.length > 0)) return Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		});
		let r = Object.freeze(Kt(f("blocked-permissions-container")).flatMap((e) => {
			if (!Z(e) || !$(e, "showing")) return [];
			let t = Wt(e, "data-permission-id"), n = t ? Mt[t] : void 0;
			return n ? [n] : [];
		}));
		return Object.freeze({
			available: !0,
			blocked: r,
			hasPermissions: $(t, "hasPermissions"),
			sharing: n
		});
	}, v = () => {
		let e = d(), t = p(), n = new Set();
		$(m(), "remotecontrol") && n.add("remote-control"), $(t, "searchmode") && n.add("search-mode"), $(t, "persistsearchterms") && n.add("persisted-search");
		for (let { id: t, kind: r } of Pt) {
			let i = zt(e, t);
			Z(i) && Gt(i) && n.add(r);
		}
		let r = zt(e, "pageActionButton");
		Z(r) && $(r, "multiple-children") && n.add("more-page-actions");
		for (let e of Kt(f("page-action-buttons"))) {
			if (!Z(e) || !Gt(e) || !qt(e, "urlbar-page-action")) continue;
			let t = typeof e.id == "string" ? e.id : "";
			Ft.has(t) || (qt(e, "urlbar-addon-page-action") ? n.add("extension-actions") : $(e, "actionid") && n.add("other-page-actions"));
		}
		return Object.freeze(At.filter((e) => n.has(e)));
	}, y = () => Object.freeze({
		items: v(),
		permissions: g()
	}), x = () => {
		let n = Object.freeze({
			revision: s,
			snapshot: l,
			type: "snapshot"
		});
		for (let r of Array.from(u)) try {
			r(n);
		} catch (n) {
			t(Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED", "firefox-urlbar-coverage-notify", "urlbarCoverage.subscribe", n));
		}
	}, S = (e) => {
		let t = y();
		return Jt(l, t) && s > 0 ? !1 : (l = t, s += 1, e && x(), !0);
	}, C = (n) => {
		o = _(n) ? n : Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_EVENT_FAILED", "firefox-urlbar-coverage-event", "window.MutationObserver", n), t(o);
	}, w = Object.freeze({
		openNativeUrlbar() {
			let t = d(), r = t.openLocation;
			if (!X(r)) throw Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-native-access", "window.openLocation");
			try {
				if (n() !== !0) throw Q(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_UI_HANDOFF_REJECTED", "firefox-urlbar-native-access", "nativeUi.revealForUrlbar");
				return Reflect.apply(r, t, []), !0;
			} catch (t) {
				throw _(t) ? t : Q(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_ACCESS_FAILED", "firefox-urlbar-native-access", "window.openLocation", t);
			}
		},
		snapshot() {
			return d(), l;
		},
		subscribe(t) {
			if (d(), typeof t != "function") throw Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_LISTENER_INVALID", "firefox-urlbar-coverage-subscribe", "urlbarCoverage.subscribe");
			return u.add(t), b(() => {
				u.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), h(), S(!1);
		let t = d().MutationObserver;
		c = new t(() => {
			if (!(a || o)) try {
				S(!0);
			} catch (e) {
				C(e);
			}
		}), c.observe(m(), {
			attributeFilter: ["remotecontrol"],
			attributes: !0
		}), c.observe(p(), {
			attributeFilter: [
				"pageproxystate",
				"persistsearchterms",
				"searchmode"
			],
			attributes: !0
		}), c.observe(f("identity-permission-box"), {
			attributeFilter: [
				"collapsed",
				"hasPermissions",
				"hasSharingIcon",
				"hidden",
				"paused",
				"sharing",
				"showing"
			],
			attributes: !0,
			subtree: !0
		}), c.observe(f("page-action-buttons"), {
			attributeFilter: [
				"actionid",
				"class",
				"collapsed",
				"disabled",
				"hidden",
				"multiple-children"
			],
			attributes: !0,
			childList: !0,
			subtree: !0
		});
	} catch (n) {
		a = !0;
		try {
			c?.disconnect();
		} catch (n) {
			t(Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", n));
		}
		throw c = null, i = null, n;
	}
	return Object.freeze({
		assertRequiredCapabilities: h,
		dispose() {
			if (a) return !1;
			a = !0;
			let t;
			try {
				c?.disconnect();
			} catch (e) {
				t = e;
			}
			if (c = null, u.clear(), i = null, t !== void 0) throw Q(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", t);
			return !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: a,
				failed: o !== null,
				revision: s,
				subscriberCount: u.size
			});
		},
		urlbarCoverage: w
	});
}
//#endregion
export { g as FirefoxBridgeError, oe as createFirefoxBookmarksBridge, T as createFirefoxBridgeBoundary, me as createFirefoxBrowserToolsBridge, Ee as createFirefoxDownloadsBridge, ut as createFirefoxNavigationBridge, Dt as createFirefoxTabsBridge, Yt as createFirefoxUrlbarCoverageBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, _ as isFirefoxBridgeError, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic };
