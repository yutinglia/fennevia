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
var E = "resource://gre/modules/PlacesUtils.sys.mjs", D = "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs", O = Object.freeze([
	"bookmark-added",
	"bookmark-removed",
	"bookmark-moved",
	"bookmark-title-changed",
	"bookmark-url-changed"
]), k = 16, A = 128, ee = 1e6, te = /^[A-Za-z0-9_-]{12}$/u, j = new Set([
	"data:",
	"javascript:",
	"place:",
	"vbscript:"
]), M = (e) => typeof e == "object" && !!e, ne = (e) => typeof e == "function", re = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, N = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: re(e),
	phase: n,
	symbol: r
}), ie = (e, t, n, r) => {
	if (typeof t != "string" || !te.test(t)) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_GUID_INVALID", n, r);
	return t;
}, P = (e) => {
	let t = "", n = 0;
	for (let r of e) {
		if (n >= 160) break;
		t += r, n += 1;
	}
	return t;
}, ae = (e, t, n, r, i) => {
	if (!M(t) || typeof t.guid != "string" || typeof t.parentGuid != "string" || typeof t.index != "number" || !Number.isSafeInteger(t.index) || t.index < 0 || typeof t.type != "number" || typeof t.title != "string" || (ie(e, t.guid, r, "PlacesUtils.bookmarks.fetch.result.guid"), ie(e, t.parentGuid, r, "PlacesUtils.bookmarks.fetch.result.parentGuid"), i !== void 0 && t.guid !== i || ![
		n.TYPE_BOOKMARK,
		n.TYPE_FOLDER,
		n.TYPE_SEPARATOR
	].includes(t.type) || t.type === n.TYPE_FOLDER && (!Number.isSafeInteger(t.childCount) || t.childCount < 0))) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID", r, "PlacesUtils.bookmarks.fetch.result");
	return t;
}, oe = (e, t, n) => {
	if (t.type === n.TYPE_BOOKMARK) return "bookmark";
	if (t.type === n.TYPE_FOLDER) return "folder";
	if (t.type === n.TYPE_SEPARATOR) return "separator";
	throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_TYPE_INVALID", "firefox-bookmarks-snapshot", "PlacesUtils.bookmarks.TYPE_BOOKMARK");
}, se = (e) => {
	if (!M(e) || typeof e.href != "string") return null;
	if (typeof e.protocol == "string") return e.protocol.toLowerCase();
	let t = e.href.indexOf(":");
	return t > 0 ? `${e.href.slice(0, t).toLowerCase()}:` : null;
};
function ce({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !M(r) || typeof t != "function" || typeof n != "function") throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_OPTIONS_INVALID", "firefox-bookmarks-create", "ChromeUtils.importESModule");
	let i, a;
	try {
		i = t(E), a = t(D);
	} catch (t) {
		throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_MODULE_LOAD_FAILED", "firefox-bookmarks-module-load", "ChromeUtils.importESModule", t);
	}
	let o = M(i) ? i.PlacesUtils : void 0, s = M(a) ? a.PlacesUIUtils : void 0, c = o, l = s, u = Object.freeze([
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-utils",
			read: () => o,
			symbol: "PlacesUtils"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-bookmarks",
			read: () => c?.bookmarks,
			symbol: "PlacesUtils.bookmarks"
		}),
		Object.freeze({
			isAvailable: ne,
			name: "firefox.places-bookmarks-fetch",
			read: () => c?.bookmarks?.fetch,
			symbol: "PlacesUtils.bookmarks.fetch"
		}),
		Object.freeze({
			isAvailable: (e) => Array.isArray(e) && e.length === 4 && e.every((e) => typeof e == "string" && te.test(e)),
			name: "firefox.places-bookmark-roots",
			read: () => c?.bookmarks?.userContentRoots,
			symbol: "PlacesUtils.bookmarks.userContentRoots"
		}),
		Object.freeze({
			isAvailable: ne,
			name: "firefox.places-root-title",
			read: () => c?.bookmarks?.getLocalizedTitle,
			symbol: "PlacesUtils.bookmarks.getLocalizedTitle"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-observers",
			read: () => c?.observers,
			symbol: "PlacesUtils.observers"
		}),
		...["addListener", "removeListener"].map((e) => Object.freeze({
			isAvailable: ne,
			name: `firefox.places-observers-${e.toLowerCase()}`,
			read: () => c?.observers?.[e],
			symbol: `PlacesUtils.observers.${e}`
		})),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-ui-utils",
			read: () => s,
			symbol: "PlacesUIUtils"
		}),
		Object.freeze({
			isAvailable: ne,
			name: "firefox.places-node-conversion",
			read: () => l?.promiseNodeLikeFromFetchInfo,
			symbol: "PlacesUIUtils.promiseNodeLikeFromFetchInfo"
		}),
		Object.freeze({
			isAvailable: ne,
			name: "firefox.places-open-node",
			read: () => l?.openNodeIn,
			symbol: "PlacesUIUtils.openNodeIn"
		})
	]), d = r, f = !1, p = null, m = !1, h = 0, g = new Set(), v = e.createHandleRegistry("bookmark"), y = new Map(), x = new Map(), S = () => {
		if (f || !d) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSED", "firefox-bookmarks-access", "window");
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
		if (n) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING", "firefox-bookmarks-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (t) => {
		S();
		let n = ie(e, t, "firefox-bookmarks-handle", "PlacesUtils.bookmarks.guid"), r = x.get(n);
		if (r) return r;
		let i = Object.freeze({ guid: n }), a = v.register(i);
		return y.set(n, i), x.set(n, a), a;
	}, re = (e) => {
		if (typeof e != "string" || !te.test(e)) return !1;
		let t = x.get(e);
		if (!t) return !1;
		x.delete(e), y.delete(e);
		try {
			return v.release(t);
		} catch {
			return !1;
		}
	}, ce = (e) => (S(), v.resolve(e).guid), le = (t, n = t.title) => {
		let r = oe(e, t, c.bookmarks);
		return Object.freeze({
			hasChildren: r === "folder" && Number.isSafeInteger(t.childCount) && t.childCount > 0,
			id: T(t.guid),
			kind: r,
			title: P(n)
		});
	}, ue = async (t, n) => {
		S();
		let r;
		try {
			r = await Reflect.apply(c.bookmarks.fetch, c.bookmarks, [t]);
		} catch (t) {
			throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_FAILED", n, "PlacesUtils.bookmarks.fetch", t);
		}
		return S(), r === null ? null : ae(e, r, c.bookmarks, n, "guid" in t ? t.guid : void 0);
	}, de = (t, r) => {
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
			n(N(e, "FENNEVIA_FIREFOX_BOOKMARKS_SUBSCRIBER_FAILED", "firefox-bookmarks-notify", "bookmarks.subscribe", t));
		}
	}, fe = (t) => {
		p = _(t) ? t : N(e, "FENNEVIA_FIREFOX_BOOKMARKS_OBSERVER_FAILED", "firefox-bookmarks-observer", "PlacesUtils.observers.addListener", t), n(p);
	}, pe = (t) => {
		if (!(f || p)) try {
			if (!Array.isArray(t)) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEventCallback.events");
			if (t.length > A) {
				de(Object.freeze([]), "all");
				return;
			}
			let n = new Set(), r = [];
			for (let i of t) {
				if (!M(i) || typeof i.type != "string" || !O.includes(i.type) || typeof i.parentGuid != "string" || typeof i.isTagging != "boolean") throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEvent");
				if (i.isTagging) continue;
				ie(e, i.parentGuid, "firefox-bookmarks-observer", "PlacesEvent.parentGuid");
				let t = x.get(i.parentGuid);
				if (t && n.add(t), i.type === "bookmark-moved") {
					let t = ie(e, i.oldParentGuid, "firefox-bookmarks-observer", "PlacesBookmarkMoved.oldParentGuid"), r = x.get(t);
					r && n.add(r);
				}
				i.type === "bookmark-removed" && r.push(ie(e, i.guid, "firefox-bookmarks-observer", "PlacesBookmarkRemoved.guid"));
			}
			let i = Array.from(n);
			i.length > k ? de(Object.freeze([]), "all") : i.length > 0 && de(Object.freeze(i), "parents");
			for (let e of r) re(e);
		} catch (e) {
			fe(e);
		}
	}, F = b(() => {
		m && (m = !1, Reflect.apply(c.observers.removeListener, c.observers, [O, pe]));
	}), me = Object.freeze({
		async children(t, n = {}) {
			let r;
			try {
				r = ce(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					parentId: t,
					status: "stale"
				});
				throw e;
			}
			if (!M(n) || Object.keys(n).some((e) => e !== "limit" && e !== "offset")) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let i = n.limit ?? 32, a = n.offset ?? 0;
			if (!Number.isSafeInteger(i) || i < 1 || i > 32 || !Number.isSafeInteger(a) || a < 0 || a > ee) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let o = await ue({ guid: r }, "firefox-bookmarks-query-parent");
			if (!o) return re(r), Object.freeze({
				parentId: t,
				status: "stale"
			});
			if (o.type !== c.bookmarks.TYPE_FOLDER) return Object.freeze({
				parentId: t,
				status: "stale"
			});
			let s = o.childCount, l = s === 0 ? 0 : Math.min(a, Math.floor((s - 1) / i) * i), u = Math.min(s, l + i), d = [];
			for (let e = l; e < u; e += 1) {
				let n = await ue({
					index: e,
					parentGuid: r
				}, "firefox-bookmarks-query-child");
				if (!n || n.parentGuid !== r || n.index !== e) return Object.freeze({
					parentId: t,
					status: "stale"
				});
				d.push(le(n));
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
			if (n !== "current" && n !== "new-tab") throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_DISPOSITION_INVALID", "firefox-bookmarks-open", "bookmarks.open.disposition");
			let r;
			try {
				r = ce(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					reason: "stale",
					status: "rejected"
				});
				throw e;
			}
			let i = await ue({ guid: r }, "firefox-bookmarks-open-fetch");
			if (!i) return re(r), Object.freeze({
				reason: "stale",
				status: "rejected"
			});
			if (i.type !== c.bookmarks.TYPE_BOOKMARK) return Object.freeze({
				reason: "not-bookmark",
				status: "rejected"
			});
			let a = se(i.url);
			if (!a || j.has(a)) return Object.freeze({
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
				throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_OPEN_FAILED", "firefox-bookmarks-open", "PlacesUIUtils.openNodeIn", t);
			}
			return Object.freeze({ status: "opened" });
		},
		async roots() {
			S();
			let t = c.bookmarks.userContentRoots, n = [];
			for (let r of t) {
				let t = await ue({ guid: r }, "firefox-bookmarks-query-roots");
				if (!t || t.type !== c.bookmarks.TYPE_FOLDER) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.userContentRoots");
				let i;
				try {
					i = Reflect.apply(c.bookmarks.getLocalizedTitle, c.bookmarks, [t]);
				} catch (t) {
					throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_FAILED", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle", t);
				}
				if (typeof i != "string") throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle");
				n.push(le(t, i));
			}
			return Object.freeze(n);
		},
		subscribe(t) {
			if (S(), typeof t != "function") throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_LISTENER_INVALID", "firefox-bookmarks-subscribe", "bookmarks.subscribe");
			return g.add(t), b(() => {
				g.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), Reflect.apply(c.observers.addListener, c.observers, [O, pe]), m = !0;
	} catch (t) {
		f = !0, d = null;
		let r;
		try {
			F();
		} catch (e) {
			r = e;
		}
		try {
			v.dispose();
		} catch (e) {
			r ??= e;
		}
		throw r !== void 0 && n(N(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", r)), t;
	}
	return Object.freeze({
		assertRequiredCapabilities: w,
		bookmarks: me,
		dispose() {
			if (f) return !1;
			f = !0, d = null;
			let t;
			try {
				F();
			} catch (e) {
				t = e;
			}
			g.clear(), y.clear(), x.clear();
			try {
				v.dispose();
			} catch (e) {
				t ??= e;
			}
			if (t !== void 0) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", t);
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
var le = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"application-menu",
	"settings",
	"customize",
	"native-toolbar"
]), ue = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"application-menu"
]), de = new Set(le), fe = new Set(ue);
function pe(e) {
	return typeof e == "string" && de.has(e);
}
function F(e) {
	return typeof e == "string" && fe.has(e);
}
//#endregion
//#region src/firefox/browser-tools.ts
var me = Object.freeze({ capture: !0 }), he = Object.freeze([
	"appMenu-popup",
	"downloadsPanel",
	"identity-popup",
	"permission-popup",
	"protections-popup",
	"trustpanel-popup",
	"unified-extensions-panel"
]), ge = new Set(he), I = Object.freeze({
	"application-menu": Object.freeze(["appMenu-popup"]),
	downloads: Object.freeze(["downloadsPanel"]),
	extensions: Object.freeze(["unified-extensions-panel"]),
	protections: Object.freeze(["trustpanel-popup", "protections-popup"]),
	"site-information": Object.freeze(["trustpanel-popup", "identity-popup"]),
	"site-permissions": Object.freeze(["permission-popup"])
}), _e = "bottomcenter topright", ve = Object.freeze({
	"application-menu": _e,
	downloads: "after_start",
	extensions: "after_end",
	protections: "end_before",
	"site-information": "end_before",
	"site-permissions": "after_end"
}), ye = (e) => e === _e, L = (e) => typeof e == "object" && !!e, R = (e) => typeof e == "function", be = (e) => {
	let t = e.PanelMultiView;
	if (typeof t == "function") {
		let e = t;
		return R(e.openPopup) ? e : null;
	}
	return L(t) && R(t.openPopup) ? t : null;
}, xe = (e) => L(e) && R(e.addEventListener) && R(e.removeEventListener), Se = (e) => L(e) && R(e.click) && R(e.focus), z = (e) => L(e) && R(e.hidePopup) && R(e.moveToAnchor) && R(e.openPopup), B = (e) => typeof e == "number" && Number.isFinite(e) ? e : void 0, Ce = (e) => {
	try {
		let t = Reflect.apply(e.getBoundingClientRect, e, []);
		if (!L(t)) return null;
		let n = B(t.left) ?? B(t.x), r = B(t.top) ?? B(t.y), i = B(t.width), a = B(t.height);
		return n === void 0 || r === void 0 || i === void 0 || a === void 0 ? null : Object.freeze({
			height: Math.max(1, Math.round(a)),
			width: Math.max(1, Math.round(i)),
			x: Math.round(n),
			y: Math.round(r)
		});
	} catch {
		return null;
	}
}, we = (e) => {
	let t = B(e.mozInnerScreenX) ?? 0, n = B(e.mozInnerScreenY) ?? 0;
	return Object.freeze({
		x: Math.round(t),
		y: Math.round(n)
	});
}, V = (e, t) => {
	let n = e.document;
	if (!(!L(n) || !R(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Te = (e) => L(e) ? e.panel : void 0, H = (e) => Object.freeze(e), Ee = Object.freeze([
	H({
		isAvailable: (e) => Se(e) && R(e.checkVisibility),
		name: "browser-tools.trust-anchor",
		read: (e) => V(e, "trust-icon-container"),
		symbol: "document.trust-icon-container.click.focus.checkVisibility"
	}),
	H({
		isAvailable: Se,
		name: "browser-tools.identity-anchor",
		read: (e) => V(e, "identity-icon-box"),
		symbol: "document.identity-icon-box.click.focus"
	}),
	H({
		isAvailable: Se,
		name: "browser-tools.protections-anchor",
		read: (e) => V(e, "tracking-protection-icon-container"),
		symbol: "document.tracking-protection-icon-container.click.focus"
	}),
	H({
		isAvailable: Se,
		name: "browser-tools.permissions-anchor",
		read: (e) => V(e, "identity-permission-box"),
		symbol: "document.identity-permission-box.click.focus"
	}),
	H({
		isAvailable: Se,
		name: "browser-tools.downloads-anchor",
		read: (e) => V(e, "downloads-button"),
		symbol: "document.downloads-button.click.focus"
	}),
	H({
		isAvailable: R,
		name: "browser-tools.unified-extensions",
		read: (e) => L(e.gUnifiedExtensions) ? e.gUnifiedExtensions.togglePanel : void 0,
		symbol: "window.gUnifiedExtensions.togglePanel"
	}),
	H({
		isAvailable: R,
		name: "browser-tools.application-menu",
		read: (e) => L(e.PanelUI) ? e.PanelUI.show : void 0,
		symbol: "window.PanelUI.show"
	}),
	H({
		isAvailable: R,
		name: "browser-tools.application-menu-ready",
		read: (e) => L(e.PanelUI) ? e.PanelUI.ensureReady : void 0,
		symbol: "window.PanelUI.ensureReady"
	}),
	H({
		isAvailable: R,
		name: "browser-tools.settings",
		read: (e) => e.openPreferences,
		symbol: "window.openPreferences"
	}),
	H({
		isAvailable: R,
		name: "browser-tools.customize",
		read: (e) => L(e.gCustomizeMode) ? e.gCustomizeMode.enter : void 0,
		symbol: "window.gCustomizeMode.enter"
	}),
	H({
		isAvailable: (e) => L(e) && R(e.focus),
		name: "browser-tools.native-toolbar-focus",
		read: (e) => V(e, "back-button"),
		symbol: "document.back-button.focus"
	}),
	H({
		isAvailable: Se,
		name: "browser-tools.extensions-anchor",
		read: (e) => V(e, "unified-extensions-button"),
		symbol: "document.unified-extensions-button.click.focus"
	}),
	H({
		isAvailable: Se,
		name: "browser-tools.application-menu-anchor",
		read: (e) => V(e, "PanelUI-menu-button"),
		symbol: "document.PanelUI-menu-button.click.focus"
	}),
	H({
		isAvailable: R,
		name: "browser-tools.trust-panel",
		read: (e) => L(e.gTrustPanelHandler) ? e.gTrustPanelHandler.showPopup : void 0,
		symbol: "window.gTrustPanelHandler.showPopup"
	}),
	H({
		isAvailable: R,
		name: "browser-tools.permission-set-anchor",
		read: (e) => L(e.gPermissionPanel) ? e.gPermissionPanel.setAnchor : void 0,
		symbol: "window.gPermissionPanel.setAnchor"
	}),
	H({
		isAvailable: R,
		name: "browser-tools.permission-open-popup",
		read: (e) => L(e.gPermissionPanel) ? e.gPermissionPanel.openPopup : void 0,
		symbol: "window.gPermissionPanel.openPopup"
	}),
	H({
		isAvailable: R,
		name: "browser-tools.downloads-initialize",
		read: (e) => L(e.DownloadsPanel) ? e.DownloadsPanel.initialize : void 0,
		symbol: "window.DownloadsPanel.initialize"
	}),
	H({
		isAvailable: z,
		name: "browser-tools.downloads-panel",
		read: (e) => {
			let t = V(e, "downloadsPanel");
			return z(t) ? t : Te(e.DownloadsPanel);
		},
		symbol: "document.downloadsPanel.openPopup.moveToAnchor.hidePopup"
	}),
	H({
		isAvailable: z,
		name: "browser-tools.application-menu-panel",
		read: (e) => {
			let t = V(e, "appMenu-popup");
			return z(t) ? t : Te(e.PanelUI);
		},
		symbol: "document.appMenu-popup.openPopup.moveToAnchor.hidePopup"
	}),
	H({
		isAvailable: z,
		name: "browser-tools.extensions-panel",
		read: (e) => {
			let t = V(e, "unified-extensions-panel");
			return z(t) ? t : Te(e.gUnifiedExtensions);
		},
		symbol: "document.unified-extensions-panel.openPopup.moveToAnchor.hidePopup"
	}),
	H({
		isAvailable: xe,
		name: "browser-tools.document-events",
		read: (e) => e.document,
		symbol: "document.addEventListener.removeEventListener"
	})
]), De = (e) => Object.freeze(Ee.map((t) => {
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
})), Oe = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, U = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Oe(e),
	phase: n,
	symbol: r
}), ke = (e) => {
	let t = (t) => e.some((e) => e.snapshot.name === t && e.snapshot.available);
	return Object.freeze({
		applicationMenu: t("browser-tools.application-menu"),
		customize: t("browser-tools.customize"),
		downloads: t("browser-tools.downloads-anchor"),
		extensions: t("browser-tools.unified-extensions"),
		nativeToolbar: t("browser-tools.native-toolbar-focus"),
		protections: t("browser-tools.trust-panel") && t("browser-tools.protections-anchor"),
		settings: t("browser-tools.settings"),
		siteInformation: t("browser-tools.trust-panel") && t("browser-tools.identity-anchor"),
		sitePermissions: t("browser-tools.permission-open-popup")
	});
}, Ae = (e) => {
	let t = e.state;
	if (t === "open" || t === "showing") return !0;
	let n = e.getAttribute;
	if (!R(n)) return !1;
	let r = Reflect.apply(n, e, ["state"]);
	return r === "open" || r === "showing";
}, je = (e) => L(e) ? L(e.originalTarget) ? e.originalTarget : L(e.target) ? e.target : null : null;
function Me({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, frame: r, requestNativeUiReveal: i, window: a }) {
	if (t.assertOwnsWindow(a), !L(a) || !L(r) || typeof r.contains != "function" || typeof i != "function" || typeof e != "function" || typeof n != "function") throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID", "firefox-browser-tools-create", "window");
	let o = (e) => Reflect.apply(r.contains, r, [e]) === !0, s = a, c = !1, l = 0, u = null, d = new Set(), f = [], p = new Set(), m = new Set(), h = () => {
		if (c || !s) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED", "firefox-browser-tools-access", "window");
		return s;
	}, g = () => {
		let e = De(h()), n = e.find((e) => !e.snapshot.available);
		if (n) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(e.map((e) => e.snapshot));
	}, v = () => {
		let e;
		try {
			e = i() === !0;
		} catch (e) {
			throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_FAILED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar", e);
		}
		if (!e) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar");
	}, y = async (e, n, r, i = []) => {
		let a = e[n];
		if (!R(a)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", r);
		try {
			await Reflect.apply(a, e, i);
		} catch (e) {
			throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", r, e);
		}
	}, b = (e) => {
		let n = h();
		if (!L(e) || !R(e.getBoundingClientRect) || e.ownerDocument !== n.document || o(e) !== !0) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID", "firefox-browser-tools-action", "browser-tools.host");
		return e;
	}, x = (e) => {
		let t = h();
		for (let n of e) {
			let e = V(t, n);
			if (z(e) && Ae(e)) return e;
		}
		return null;
	}, S = (n) => {
		let r;
		try {
			r = e(n) === !0;
		} catch (e) {
			throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_FAILED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff", e);
		}
		if (!r) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_REJECTED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff");
	}, C = (e) => {
		try {
			n(e);
		} catch {}
	}, w = (e, n) => {
		try {
			Reflect.apply(e.hidePopup, e, []);
		} catch (e) {
			throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", n, e);
		}
	}, T = (e, n, r, i) => {
		try {
			Reflect.apply(e.openPopup, e, [
				n,
				r,
				0,
				0
			]);
		} catch (e) {
			throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
		}
	}, E = (e, n, r, i) => {
		try {
			Reflect.apply(e.moveToAnchor, e, [
				n,
				r,
				0,
				0
			]);
		} catch (e) {
			throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
		}
	}, D = (e, t, n, r) => {
		if (ye(n)) {
			let n = Ce(t), r = we(h()), i = e.moveTo;
			if (n && R(i)) try {
				let t = r.x + n.x, a = r.y + n.y + n.height, o = e.getOuterScreenRect;
				if (R(o)) {
					let i = Reflect.apply(o, e, []);
					if (L(i)) {
						let e = B(i.width);
						e !== void 0 && (t = r.x + n.x + n.width - Math.round(e));
					}
				}
				Reflect.apply(i, e, [t, a]);
				return;
			} catch {}
		}
		E(e, t, n, r);
	}, O = (e) => {
		let t = h();
		for (let n of he) {
			if (e.has(n)) continue;
			let r = V(t, n);
			z(r) && Ae(r) && w(r, `document.${n}.hidePopup`);
		}
	}, k = (e, t) => {
		let n = e.closest;
		if (R(n)) try {
			if (Reflect.apply(n, e, ["[data-fennevia-address-popup]"]) != null) return "after_end";
			if (Reflect.apply(n, e, ["[data-fennevia-edge=\"left\"]"]) != null) return "end_before";
		} catch {}
		return ve[t];
	}, A = (e) => {
		let t = h();
		for (let n of I[e]) {
			let e = V(t, n);
			if (z(e)) return e;
		}
		return x(I[e]);
	}, ee = (e) => {
		let n = A(e);
		if (!n) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", `document.${I[e][0]}.openPopup.moveToAnchor.hidePopup`);
		return n;
	}, te = async (e, n, r, i) => {
		let a = h(), o = be(a), s = Ce(n), c = we(a), l, u = () => Ae(e), d = async (e) => {
			try {
				await e();
			} catch (e) {
				return l = e, u();
			}
			return u();
		}, f = () => {
			if (ye(r)) try {
				D(e, n, r, `${i}.moveTo`);
			} catch {}
		}, p = o && R(o.openPopup) ? o.openPopup : void 0, m = async (t, n) => !o || !p ? !1 : d(() => Reflect.apply(p, o, [
			e,
			t,
			n
		])), g = () => m(n, Object.freeze({ position: r })), v = () => m(n, r), y = () => s ? m(null, Object.freeze({
			x: s.x,
			y: s.y + s.height
		})) : Promise.resolve(!1), b = () => d(() => {
			T(e, n, r, `${i}.openPopup`);
		}), x = () => {
			let t = e.openPopupAtScreenRect;
			return !s || !R(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
				r,
				c.x + s.x,
				c.y + s.y,
				s.width,
				s.height,
				!1,
				!1
			]));
		}, S = () => {
			let t = e.openPopupAtScreen;
			return !s || !R(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
				c.x + s.x,
				c.y + s.y + s.height,
				!1
			]));
		}, C = (() => {
			let t = e.querySelector;
			if (!R(t)) return !1;
			try {
				return Reflect.apply(t, e, ["panelmultiview"]) != null;
			} catch {
				return !1;
			}
		})(), w = p && (C || ye(r)) ? ye(r) ? [
			async () => {
				let t = e.openPopupAtScreenRect, i = e.openPopup;
				if (!s || !p || !R(t) || !R(i)) return !1;
				let a = () => Reflect.apply(t, e, [
					r,
					c.x + s.x,
					c.y + s.y,
					s.width,
					s.height,
					!1,
					!1
				]);
				try {
					e.openPopup = a;
				} catch {
					return !1;
				}
				try {
					return await m(n, Object.freeze({ position: r }));
				} finally {
					try {
						e.openPopup = i;
					} catch {}
				}
			},
			y,
			g,
			v
		] : [
			g,
			v,
			y
		] : ye(r) ? [
			y,
			x,
			g,
			v,
			b,
			S
		] : [
			g,
			v,
			y,
			b,
			x,
			S
		];
		for (let e of w) {
			if (await e()) {
				f();
				return;
			}
			await Promise.resolve();
		}
		if (u()) {
			f();
			return;
		}
		throw _(l) ? l : U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", `${i}.openPopup`, l);
	}, j = async (e, t, n) => {
		let r = ee(e), i = typeof r.id == "string" && r.id ? r.id : I[e][0];
		return Ae(r) ? (E(r, t, n, `document.${i}.moveToAnchor`), r) : (await te(r, t, n, `document.${i}`), r);
	}, M = async () => {
		let e = h(), t = e.promiseDocumentFlushed;
		if (R(t)) try {
			await Reflect.apply(t, e, [() => void 0]);
			return;
		} catch {}
		await Promise.resolve();
	}, ne = (e, t = 800) => {
		let n = h(), r = V(n, e);
		return z(r) && Ae(r) ? Promise.resolve(!0) : new Promise((r) => {
			let i = !1, a = (e) => {
				i || (i = !0, r(e));
			}, o = {
				panelId: e,
				resolve: a,
				timeoutHandle: void 0
			}, s = n.setTimeout;
			R(s) ? o.timeoutHandle = Reflect.apply(s, n, [() => {
				m.delete(o);
				let t = V(n, e);
				a(z(t) && Ae(t));
			}, t]) : queueMicrotask(() => {
				m.delete(o);
				let t = V(n, e);
				a(z(t) && Ae(t));
			}), m.add(o);
		});
	}, re = (e, t) => {
		let n = s;
		for (let r of Array.from(m)) if (r.panelId === e) {
			if (m.delete(r), n && R(n.clearTimeout)) try {
				Reflect.apply(n.clearTimeout, n, [r.timeoutHandle]);
			} catch {}
			r.resolve(t);
		}
	}, N = async (e, t) => {
		let n = b(t), r = I[e][0], i = k(n, e);
		O(new Set(I[e])), await M();
		for (let t of I[e]) S(t);
		return u = Object.freeze({
			host: n,
			panelId: r,
			position: i
		}), u;
	}, ie = () => {
		let e = s;
		if (!e || !L(e.gPermissionPanel)) return;
		let t = e.gPermissionPanel.setAnchor;
		if (R(t)) try {
			Reflect.apply(t, e.gPermissionPanel, [null, "bottomleft topleft"]);
		} catch {}
	}, P = (e) => {
		let t = Object.freeze({
			open: e,
			type: "native-popup"
		});
		for (let e of Array.from(p)) e(t);
	}, ae = (e) => {
		if (c) return;
		let t = je(e), n = typeof t?.id == "string" ? t.id : typeof t?.getAttribute == "function" ? t.getAttribute("id") : void 0;
		if (typeof n != "string" || !ge.has(n)) return;
		let r = L(e) ? e.type : void 0;
		if (r === "popupshown") {
			re(n, !0);
			for (let e of he) e !== n && C(e);
			if (u && z(t)) try {
				D(t, u.host, u.position, `document.${n}.moveToAnchor`);
			} catch {}
			P(!0);
			return;
		}
		if (r === "popuphidden") {
			if (d.has(n)) return;
			u = null, n === "permission-popup" && ie(), C(n), P(!1);
		}
	}, oe = async (e, n) => {
		let r = h(), i = await N(e, n);
		for (let t of I[e]) d.add(t);
		try {
			switch (e) {
				case "site-information":
				case "protections": {
					if (!L(r.gTrustPanelHandler)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gTrustPanelHandler.showPopup");
					try {
						await y(r.gTrustPanelHandler, "showPopup", "window.gTrustPanelHandler.showPopup");
					} catch {}
					let n = x(I[e]);
					return n ? (E(n, i.host, i.position, `document.${n.id ?? i.panelId}.moveToAnchor`), !0) : (await j(e, i.host, i.position), !0);
				}
				case "site-permissions": {
					if (!L(r.gPermissionPanel)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					let n = r.gPermissionPanel.setAnchor;
					if (!R(n)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					try {
						Reflect.apply(n, r.gPermissionPanel, [i.host, i.position]);
					} catch (e) {
						throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor", e);
					}
					try {
						await y(r.gPermissionPanel, "openPopup", "window.gPermissionPanel.openPopup", [Object.freeze({})]);
					} catch {}
					let a = x(I[e]);
					return a ? (E(a, i.host, i.position, "document.permission-popup.moveToAnchor"), !0) : (await j(e, i.host, i.position), !0);
				}
				case "downloads":
					if (!L(r.DownloadsPanel)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.DownloadsPanel.initialize");
					return await y(r.DownloadsPanel, "initialize", "window.DownloadsPanel.initialize"), await j(e, i.host, i.position), !0;
				case "extensions": {
					let n = ee(e);
					if (Ae(n)) {
						w(n, "document.unified-extensions-panel.hidePopup"), u = null;
						for (let t of I[e]) C(t);
						return P(!1), !0;
					}
					if (!L(r.gUnifiedExtensions)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gUnifiedExtensions.togglePanel");
					try {
						await y(r.gUnifiedExtensions, "togglePanel", "window.gUnifiedExtensions.togglePanel");
					} catch {}
					return await j(e, i.host, i.position), !0;
				}
				case "application-menu": {
					let n = ee(e);
					if (Ae(n)) {
						w(n, "document.appMenu-popup.hidePopup"), u = null;
						for (let t of I[e]) C(t);
						return P(!1), !0;
					}
					if (!L(r.PanelUI)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.ensureReady");
					await y(r.PanelUI, "ensureReady", "window.PanelUI.ensureReady");
					let a = r.PanelUI._ensureShortcutsShown;
					if (R(a)) try {
						Reflect.apply(a, r.PanelUI, []);
					} catch {}
					try {
						await j(e, i.host, i.position);
					} catch {}
					let o = A(e);
					if (o && Ae(o)) return !0;
					if (S("appMenu-popup"), !R(r.PanelUI.show)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.show");
					let s = ne("appMenu-popup");
					try {
						let e = Reflect.apply(r.PanelUI.show, r.PanelUI, []);
						Promise.resolve(e).catch(() => {});
					} catch (e) {
						throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.PanelUI.show", e);
					}
					await s;
					let c = A(e);
					return c && Ae(c) ? (D(c, i.host, i.position, "document.appMenu-popup.moveTo"), !0) : (await j(e, i.host, i.position), !0);
				}
			}
			throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
		} finally {
			for (let t of I[e]) d.delete(t);
		}
	}, se = Object.freeze({
		invoke: async (e, n) => {
			if (!pe(e)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			let r = h();
			l += 1;
			try {
				if (F(e)) return await oe(e, n);
				switch (e) {
					case "settings": return await y(r, "openPreferences", "window.openPreferences"), !0;
					case "customize":
						if (!L(r.gCustomizeMode)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gCustomizeMode.enter");
						return await y(r.gCustomizeMode, "enter", "window.gCustomizeMode.enter"), !0;
					case "native-toolbar": {
						v();
						let e = V(r, "back-button");
						if (!L(e) || !R(e.focus)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "document.back-button.focus");
						try {
							Reflect.apply(e.focus, e, [Object.freeze({ preventScroll: !0 })]);
						} catch (e) {
							throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.back-button.focus", e);
						}
						return !0;
					}
				}
				throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			} finally {
				--l;
			}
		},
		snapshot() {
			return ke(De(h()));
		},
		subscribe(e) {
			if (h(), typeof e != "function") throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_LISTENER_INVALID", "firefox-browser-tools-subscribe", "browser-tools.subscribe");
			p.add(e);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, p.delete(e), !0) : !1);
		}
	});
	try {
		t.assertRequiredCapabilities(), g();
		let e = h().document;
		if (!xe(e)) throw U(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", "document.addEventListener.removeEventListener");
		f.push(t.subscribe(e, "popupshown", ae, me), t.subscribe(e, "popuphidden", ae, me));
	} catch (e) {
		c = !0, s = null;
		for (let e of f.reverse()) try {
			e();
		} catch {}
		throw e;
	}
	return Object.freeze({
		assertRequiredCapabilities: g,
		browserTools: se,
		dispose() {
			if (c) return !1;
			c = !0;
			let e = s;
			u = null, p.clear();
			for (let e of Array.from(m)) m.delete(e), e.resolve(!1);
			if (e) {
				for (let t of he) {
					let n = V(e, t);
					if (z(n) && Ae(n)) try {
						Reflect.apply(n.hidePopup, n, []);
					} catch {}
					C(t);
				}
				ie();
			}
			s = null;
			for (let e of f.reverse()) try {
				e();
			} catch {}
			return f.length = 0, !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: c,
				pendingActionCount: l
			});
		}
	});
}
//#endregion
//#region src/firefox/downloads.ts
var Ne = "resource://gre/modules/Downloads.sys.mjs", Pe = 3, Fe = (e) => typeof e == "object" && !!e, Ie = (e) => typeof e == "function", Le = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Re = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Le(e),
	phase: n,
	symbol: r
}), ze = (e) => typeof e == "number" && Number.isFinite(e) && Number.isSafeInteger(e) && e >= 0, Be = (e, t) => {
	if (!Fe(t) || typeof t.stopped != "boolean" || typeof t.succeeded != "boolean" || typeof t.canceled != "boolean" || typeof t.hasPartialData != "boolean" || typeof t.hasProgress != "boolean" || !Number.isInteger(t.progress) || t.progress < 0 || t.progress > 100 || !ze(t.currentBytes) || !ze(t.totalBytes)) throw Re(e, "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID", "firefox-downloads-event", "Download");
	return t;
}, Ve = (e) => e.stopped ? e.succeeded ? "succeeded" : e.error ? "failed" : e.canceled ? e.hasPartialData ? "paused" : "canceled" : "queued" : "active", He = (e) => e === "succeeded" || e === "failed" || e === "canceled", Ue = (e) => Math.min(e, 999), We = () => Object.freeze({
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
function Ge({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !Fe(r) || typeof t != "function" || typeof n != "function") throw Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_OPTIONS_INVALID", "firefox-downloads-create", "ChromeUtils.importESModule");
	let i;
	try {
		i = t(Ne);
	} catch (t) {
		throw Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_MODULE_LOAD_FAILED", "firefox-downloads-module-load", "ChromeUtils.importESModule", t);
	}
	let a = Fe(i) ? i.Downloads : void 0, o = a, s = e.snapshot().windowKind === "private" ? "private" : "public", c = s === "private" ? o?.PRIVATE : o?.PUBLIC, l = Object.freeze([
		Object.freeze({
			isAvailable: Fe,
			name: "firefox.downloads",
			read: () => a,
			symbol: "Downloads"
		}),
		Object.freeze({
			isAvailable: Ie,
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
	]), u = r, d = null, f = !1, p = null, m = !0, h = 0, g = !1, v = !1, y = 0, x = 0, S = !1, C = We(), w = "", T = new Set(), E = e.createHandleRegistry("download"), D = new Map(), O = new WeakSet(), k = [], A = () => {
		if (f || !u) throw Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSED", "firefox-downloads-access", "window");
		if (p) throw p;
		return e.assertOwnsWindow(u), u;
	}, ee = () => {
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
			available: Ie(d.addView),
			name: "firefox.downloads-list-add-view",
			requirement: "required",
			symbol: "DownloadList.addView"
		}) }), Object.freeze({ snapshot: Object.freeze({
			available: Ie(d.removeView),
			name: "firefox.downloads-list-remove-view",
			requirement: "required",
			symbol: "DownloadList.removeView"
		}) })), Object.freeze(e);
	}, te = () => {
		A();
		let t = ee(), n = t.find((e) => !e.snapshot.available);
		if (n) throw Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, j = (t) => p || (p = _(t) ? t : Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_EVENT_FAILED", "firefox-downloads-event", "DownloadList.view", t), n(p), p), M = (e) => {
		let t = D.get(e);
		if (!t) return !1;
		D.delete(e);
		let n = k.indexOf(e);
		return n !== -1 && k.splice(n, 1), E.release(t.id), !0;
	}, ne = (e) => {
		let t = k.indexOf(e);
		for (t !== -1 && k.splice(t, 1), k.unshift(e); k.length > Pe;) {
			let e = k.pop();
			e && M(e);
		}
	}, re = (t) => {
		let n = Be(e, t), r = Ve(n);
		if (m && (O.add(n), He(r))) return;
		let i = D.get(n);
		if (!(!i && He(r) && O.has(n))) {
			if (i || (i = {
				currentBytes: 0,
				download: n,
				hasProgress: !1,
				id: E.register(n),
				order: ++x,
				progressPercent: null,
				state: r,
				totalBytes: 0
			}, D.set(n, i)), i.currentBytes = n.currentBytes, i.hasProgress = n.hasProgress, i.progressPercent = r === "succeeded" ? 100 : n.hasProgress ? n.progress : null, i.state = r, i.totalBytes = n.totalBytes, He(r)) ne(n);
			else {
				let e = k.indexOf(n);
				e !== -1 && k.splice(e, 1);
			}
		}
	}, N = (e) => {
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
	}, ie = () => {
		let e = {
			active: [],
			canceled: [],
			failed: [],
			paused: [],
			queued: [],
			succeeded: []
		};
		for (let t of D.values()) e[t.state].push(t);
		for (let t of [
			"active",
			"paused",
			"queued"
		]) e[t].sort((e, t) => e.order - t.order);
		let t = k.map((e) => D.get(e)).filter((e) => !!e), n = [
			...e.active,
			...e.paused,
			...e.queued,
			...t
		], r = n.slice(0, 6).map((e) => Object.freeze({
			id: e.id,
			progressPercent: e.progressPercent,
			state: e.state
		})), i = N(e.active), a = Object.freeze({
			active: e.active.length,
			canceled: e.canceled.length,
			failed: e.failed.length,
			paused: e.paused.length,
			queued: e.queued.length,
			succeeded: e.succeeded.length
		}), o = Object.values(a).some((e) => e > 999);
		return Object.freeze({
			activeCount: Ue(a.active),
			aggregatePercent: i.percent,
			canceledCount: Ue(a.canceled),
			countOverflow: o,
			failedCount: Ue(a.failed),
			items: Object.freeze(r),
			pausedCount: Ue(a.paused),
			phase: v ? "ready" : "loading",
			progressMode: i.mode,
			queuedCount: Ue(a.queued),
			revision: y + 1,
			succeededCount: Ue(a.succeeded),
			truncated: n.length > 6 || o
		});
	}, P = () => {
		if (f || p || m || h > 0) {
			g = !0;
			return;
		}
		g = !1;
		let t = ie(), n = JSON.stringify({
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
				j(Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_SUBSCRIBER_FAILED", "firefox-downloads-notify", "downloads.subscribe", t));
				return;
			}
		}
	}, ae = Object.freeze({
		onDownloadAdded(e) {
			if (!(f || p)) try {
				re(e), P();
			} catch (e) {
				j(e);
			}
		},
		onDownloadBatchEnded() {
			f || p || (h > 0 && --h, h === 0 && g && P());
		},
		onDownloadBatchStarting() {
			!f && !p && (h += 1);
		},
		onDownloadChanged(e) {
			if (!(f || p)) try {
				re(e), P();
			} catch (e) {
				j(e);
			}
		},
		onDownloadRemoved(t) {
			if (!(f || p)) try {
				let n = Be(e, t);
				M(n), P();
			} catch (e) {
				j(e);
			}
		}
	}), oe = b(() => {
		!S || !d || (S = !1, Reflect.apply(d.removeView, d, [ae]));
	});
	e.assertRequiredCapabilities(), te();
	let se = (async () => {
		try {
			let t = await Reflect.apply(o.getList, o, [c]);
			if (f) return !0;
			if (!Fe(t) || !Ie(t.addView) || !Ie(t.removeView)) throw Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", !Fe(t) || !Ie(t.addView) ? "DownloadList.addView" : "DownloadList.removeView");
			if (d = t, S = !0, Reflect.apply(d.addView, d, [ae]), f) return oe(), !0;
			if (m = !1, h = 0, p) throw p;
			return v = !0, P(), !0;
		} catch (t) {
			if (f) return !0;
			throw p ?? j(_(t) ? t : Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_INITIALIZATION_FAILED", "firefox-downloads-initialize", "Downloads.getList", t));
		}
	})();
	se.catch(() => void 0);
	let ce = Object.freeze({
		ready() {
			return A(), se;
		},
		snapshot() {
			return A(), C;
		},
		subscribe(t) {
			if (A(), typeof t != "function") throw Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_LISTENER_INVALID", "firefox-downloads-subscribe", "downloads.subscribe");
			return T.add(t), b(() => {
				T.delete(t);
			});
		}
	});
	return Object.freeze({
		assertRequiredCapabilities: te,
		dispose() {
			if (f) return !1;
			f = !0, u = null, m = !1, h = 0, g = !1;
			let t;
			try {
				oe();
			} catch (e) {
				t = e;
			}
			T.clear(), D.clear(), k.length = 0;
			try {
				E.dispose();
			} catch (e) {
				t ??= e;
			}
			if (d = null, t !== void 0) throw Re(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSE_FAILED", "firefox-downloads-dispose", "DownloadList.removeView", t);
			return !0;
		},
		downloads: ce,
		ready() {
			return A(), se;
		},
		snapshot() {
			return Object.freeze({
				disposed: f,
				failed: p !== null,
				handleCount: E.snapshot().activeHandleCount,
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
var Ke = 2048, qe = 4096, Je = (e) => {
	let t = Error(e);
	return t.name = "FenneviaNavigationStateError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "navigation-state"
		}
	}), t;
};
function Ye(e) {
	if (!e || typeof e != "object") throw Je("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	let t = e;
	if (typeof t.altKey != "boolean" || typeof t.ctrlKey != "boolean" || typeof t.metaKey != "boolean" || typeof t.shiftKey != "boolean" || !Number.isInteger(t.button) || t.button < 0 || t.button > 2) throw Je("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	return Object.freeze({
		altKey: t.altKey,
		button: t.button,
		ctrlKey: t.ctrlKey,
		metaKey: t.metaKey,
		shiftKey: t.shiftKey
	});
}
//#endregion
//#region src/firefox/navigation.ts
var Xe = Object.freeze({
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
}), Ze = Object.freeze(["TabSelect", "TabAttrModified"]), Qe = new Set([
	"busy",
	"label",
	"selected"
]), $e = "Browser:OpenLocation", et = "focusURLBar", tt = "data-fennevia-healthy", nt = Object.freeze({
	selectAll: !0,
	source: "ctrl-l",
	type: "address-popup-open"
}), rt = Object.freeze({ status: "accepted" }), it = Object.freeze({
	reason: "empty",
	status: "rejected"
}), at = Object.freeze({
	reason: "too-long",
	status: "rejected"
}), ot = Object.freeze({
	reason: "unsafe-scheme",
	status: "rejected"
}), st = /^\s*(?:data|javascript|vbscript)\s*:/iu, ct = new Set([
	"about:blank",
	"about:home",
	"about:newtab",
	"about:privatebrowsing"
]), lt = Object.freeze({
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
}), ut = (e) => `document.commands[${e.replaceAll(":", "-")}]`, W = (e) => typeof e == "object" && !!e, G = (e) => typeof e == "function", dt = (e) => W(e) && G(e.addEventListener) && G(e.removeEventListener), ft = (e) => e.gBrowser, pt = (e, t) => {
	let n = ft(e);
	return W(n) ? n[t] : void 0;
}, mt = (e, t) => {
	let n = pt(e, "selectedBrowser");
	return W(n) ? n[t] : void 0;
}, ht = (e, t) => {
	let n = e.BrowserCommands;
	return W(n) ? n[t] : void 0;
}, gt = (e, t) => {
	let n = e.gURLBar;
	return W(n) ? n[t] : void 0;
}, _t = (e, t) => e[t], vt = (e) => {
	let t = e.document;
	return W(t) ? t.documentElement : void 0;
}, yt = (e, t) => {
	let n = e.document;
	if (!(!W(n) || !G(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, bt = (e) => W(e) && G(e.hasAttribute), xt = (e) => dt(e) && typeof e.value == "string" && G(e.getAttribute) && G(e.handleCommand), St = (e) => W(e) && G(e.getConnectionSecurityInformation), Ct = (e) => W(e) && G(e.onContentBlockingEvent), wt = (e) => W(e) && G(e.canHandle), Tt = (e) => W(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", Et = (e) => W(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), Dt = Object.freeze([
	Object.freeze({
		isAvailable: Tt,
		name: "firefox.navigation-selected-browser",
		read: (e) => pt(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: Et,
		name: "firefox.navigation-current-uri",
		read: (e) => mt(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-selected-browser-focus",
		read: (e) => mt(e, "focus"),
		symbol: "window.gBrowser.selectedBrowser.focus"
	}),
	Object.freeze({
		isAvailable: (e) => W(e) && G(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => pt(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: dt,
		name: "firefox.navigation-tab-events",
		read: (e) => pt(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: G,
		name: `firefox.navigation-${e}`,
		read: (e) => pt(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: (e) => typeof e == "string",
		name: "firefox.navigation-urlbar-value",
		read: (e) => gt(e, "value"),
		symbol: "window.gURLBar.value"
	}),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-urlbar-submission",
		read: (e) => gt(e, "handleCommand"),
		symbol: "window.gURLBar.handleCommand"
	}),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-urlbar-proxy-state",
		read: (e) => gt(e, "getAttribute"),
		symbol: "window.gURLBar.getAttribute"
	}),
	Object.freeze({
		isAvailable: St,
		name: "firefox.navigation-connection-security",
		read: (e) => _t(e, "gIdentityHandler"),
		symbol: "window.gIdentityHandler.getConnectionSecurityInformation"
	}),
	Object.freeze({
		isAvailable: Ct,
		name: "firefox.navigation-tracking-protection",
		read: (e) => _t(e, "gProtectionsHandler"),
		symbol: "window.gProtectionsHandler.onContentBlockingEvent"
	}),
	Object.freeze({
		isAvailable: wt,
		name: "firefox.navigation-tracking-protection-availability",
		read: (e) => _t(e, "ContentBlockingAllowList"),
		symbol: "window.ContentBlockingAllowList.canHandle"
	}),
	Object.freeze({
		isAvailable: (e) => bt(e) && dt(e),
		name: "firefox.navigation-open-location-command",
		read: (e) => yt(e, $e),
		symbol: ut($e)
	}),
	Object.freeze({
		isAvailable: (e) => W(e) && G(e.hasAttribute),
		name: "firefox.navigation-shell-health-gate",
		read: vt,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Object.values(Xe).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: bt,
		name: `firefox.navigation-command-${t}`,
		read: (t) => yt(t, e),
		symbol: ut(e)
	}), Object.freeze({
		isAvailable: G,
		name: `firefox.navigation-action-${t}`,
		read: (e) => ht(e, t),
		symbol: `window.BrowserCommands.${t}`
	})]),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-action-home",
		read: (e) => ht(e, "home"),
		symbol: "window.BrowserCommands.home"
	}),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-action-reloadOrDuplicate",
		read: (e) => ht(e, "reloadOrDuplicate"),
		symbol: "window.BrowserCommands.reloadOrDuplicate"
	})
]), Ot = (e) => Object.freeze(Dt.map((t) => {
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
})), kt = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, K = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: kt(e),
	phase: n,
	symbol: r
}), At = (e, t) => e.addressValue === t.addressValue && e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.connectionSecurity === t.connectionSecurity && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title && e.trackingProtection === t.trackingProtection, jt = (e) => {
	if (!W(e) || !W(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Qe.has(e));
};
function Mt({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !W(n) || typeof t != "function") throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID", "firefox-navigation-create", "window");
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
		if (i || !r) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSED", "firefox-navigation-access", "window.gBrowser.selectedBrowser");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, m = () => {
		let t = p().gBrowser;
		if (!W(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gBrowser");
		return t;
	}, h = () => {
		let t = m().selectedBrowser;
		if (!Tt(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, g = () => {
		let t = m().selectedTab;
		if (!W(t) || !G(t.getAttribute)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, v = (t) => {
		let n = yt(p(), t);
		if (!bt(n)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", ut(t));
		return n;
	}, y = () => {
		let t = p().gURLBar;
		if (!xt(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gURLBar.handleCommand");
		return t;
	}, x = () => {
		let t = p().gIdentityHandler;
		if (!St(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gIdentityHandler.getConnectionSecurityInformation");
		return t;
	}, S = () => {
		let t = p().gProtectionsHandler;
		if (!Ct(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gProtectionsHandler.onContentBlockingEvent");
		return t;
	}, C = () => {
		let t = p().ContentBlockingAllowList;
		if (!wt(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.ContentBlockingAllowList.canHandle");
		return t;
	}, w = () => {
		let t = Ot(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (e) => {
		let t = v(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, E = (t) => {
		let n = t.currentURI;
		if (!Et(n)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, Ke);
	}, D = (e) => {
		if (ct.has(e)) return "";
		let t = y();
		return (Reflect.apply(t.getAttribute, t, ["pageproxystate"]) === "valid" ? t.value : e).slice(0, qe);
	}, O = () => {
		let e = x(), t = Reflect.apply(e.getConnectionSecurityInformation, e, []);
		return typeof t == "string" ? lt[t] ?? "unavailable" : "unavailable";
	}, k = (e) => {
		let t = C();
		if (Reflect.apply(t.canHandle, t, [e]) !== !0) return "unavailable";
		let n = S();
		return typeof n.hasException != "boolean" || typeof n.anyBlocking != "boolean" || typeof n.anyDetected != "boolean" ? "unavailable" : n.hasException ? "exception" : n.anyBlocking ? "blocking" : n.anyDetected ? "detected" : "no-trackers-detected";
	}, A = () => {
		let e = h(), t = g(), n = E(e);
		return Object.freeze({
			addressValue: D(n),
			canGoBack: T(Xe.back.id),
			canGoForward: T(Xe.forward.id),
			connectionSecurity: O(),
			displayUri: n,
			loading: T(Xe.stop.id),
			title: String(Reflect.apply(t.getAttribute, t, ["label"]) ?? "").slice(0, 256),
			trackingProtection: k(e)
		});
	}, ee = () => {
		let n = Object.freeze({
			revision: o,
			snapshot: s,
			type: "snapshot"
		});
		for (let r of Array.from(d)) try {
			r(n);
		} catch (n) {
			t(K(e, "FENNEVIA_FIREFOX_NAVIGATION_SUBSCRIBER_FAILED", "firefox-navigation-notify", "navigation.subscribe", n));
		}
	}, te = (e) => {
		let t = A();
		return At(s, t) && o > 0 ? !1 : (s = t, o += 1, e && ee(), !0);
	}, j = (n, r) => {
		a = _(n) ? n : K(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, M = (e) => {
		if (!(i || a)) try {
			te(!0);
		} catch (t) {
			j(t, e);
		}
	}, ne = (e, t, n) => {
		if (!(i || a)) try {
			e === m().selectedBrowser && W(t) && t.isTopLevel === !0 && te(!0);
		} catch (e) {
			j(e, n);
		}
	}, re = Object.freeze({
		onLocationChange(e, t) {
			ne(e, t, "window.gBrowser.onLocationChange");
		},
		onStateChange(e, t) {
			ne(e, t, "window.gBrowser.onStateChange");
		},
		onSecurityChange(e, t) {
			ne(e, t, "window.gBrowser.onSecurityChange");
		},
		onContentBlockingEvent(e, t) {
			ne(e, t, "window.gBrowser.onContentBlockingEvent");
		}
	}), N = (e) => ({
		altKey: e.altKey,
		button: e.button,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		preventDefault() {},
		shiftKey: e.shiftKey
	}), ie = (t, n) => {
		let r = p().BrowserCommands, i = W(r) ? r[t] : void 0;
		if (!G(i)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${t}`);
		try {
			return Reflect.apply(i, r, n === void 0 ? [] : [N(n)]), !0;
		} catch (n) {
			throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${t}`, n);
		}
	}, P = (e, t = !0, n) => {
		let r = Xe[e];
		h();
		let i = v(r.id);
		return t && Reflect.apply(i.hasAttribute, i, ["disabled"]) ? !1 : ie(r.method, n);
	}, ae = (t) => {
		if (typeof t != "string") return it;
		if (t.length > 4096) return at;
		if (t.trim().length === 0) return it;
		if (st.test(t)) return ot;
		h();
		let n = y();
		try {
			return n.value = t, Reflect.apply(n.handleCommand, n, []), rt;
		} catch (t) {
			throw K(e, "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED", "firefox-address-submit", "window.gURLBar.handleCommand", t);
		}
	}, oe = () => {
		let e = vt(p());
		return W(e) && G(e.hasAttribute) && !!Reflect.apply(e.hasAttribute, e, [tt]);
	}, se = (e) => {
		if (!W(e) || !W(e.sourceEvent)) return !1;
		let t = e.sourceEvent.target;
		return W(t) && t.id === et;
	}, ce = (e) => {
		if (!(i || a)) try {
			if (!oe() || !se(e) || f.size === 0) return;
			te(!0);
			let t = !1;
			for (let e of Array.from(f)) t = e(nt) === !0 || t;
			if (!t || !W(e)) return;
			G(e.preventDefault) && Reflect.apply(e.preventDefault, e, []), G(e.stopPropagation) && Reflect.apply(e.stopPropagation, e, []);
		} catch (e) {
			j(e, ut($e));
		}
	}, le = Object.freeze({
		back: (e) => P("back", !0, e === void 0 ? void 0 : Ye(e)),
		focusContent() {
			let t = h(), n = t.focus;
			if (!G(n)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus");
			try {
				return Reflect.apply(n, t, []), !0;
			} catch (t) {
				throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus", t);
			}
		},
		forward: (e) => P("forward", !0, e === void 0 ? void 0 : Ye(e)),
		home(e) {
			return h(), ie("home", e === void 0 ? void 0 : Ye(e));
		},
		newTab: () => P("newTab", !1),
		reload(e) {
			return e === void 0 ? P("reload") : (h(), ie("reloadOrDuplicate", Ye(e)));
		},
		reloadOrStop() {
			let e = T(Xe.stop.id) ? "stop" : "reload";
			return P(e), e;
		},
		snapshot() {
			return p(), s;
		},
		stop: () => P("stop"),
		submitAddress: ae,
		subscribe(t) {
			if (p(), typeof t != "function") throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_LISTENER_INVALID", "firefox-navigation-subscribe", "navigation.subscribe");
			return d.add(t), b(() => {
				d.delete(t);
			});
		},
		subscribeAddressPopupOpen(t) {
			if (p(), typeof t != "function") throw K(e, "FENNEVIA_FIREFOX_ADDRESS_POPUP_LISTENER_INVALID", "firefox-address-popup-subscribe", "navigation.subscribeAddressPopupOpen");
			return f.add(t), b(() => {
				f.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), te(!1);
		let t = m().tabContainer;
		for (let n of Ze) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (W(e) && e.target !== m().selectedTab || !jt(e))) return;
				te(!0);
			} catch (e) {
				j(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		u.push(e.subscribe(v($e), "command", ce));
		let n = m();
		Reflect.apply(n.addTabsProgressListener, n, [re]), l = !0;
		let r = p().MutationObserver;
		c = new r(() => {
			M("document.command.disabled");
		});
		for (let { id: e } of Object.values(Xe)) c.observe(v(e), {
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
			let e = W(r.gBrowser) ? r.gBrowser : null;
			e && G(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [re]);
		} catch (e) {
			a ??= e;
		}
		l = !1;
		for (let e of u.reverse()) try {
			e();
		} catch (e) {
			a ??= e;
		}
		throw r = null, a !== void 0 && t(K(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", a)), n;
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
				let e = W(r.gBrowser) ? r.gBrowser : null;
				if (!e || !G(e.removeTabsProgressListener)) throw TypeError("FENNEVIA_FIREFOX_NAVIGATION_PROGRESS_DISPOSER_INVALID");
				Reflect.apply(e.removeTabsProgressListener, e, [re]);
			} catch (e) {
				t ??= e;
			}
			l = !1;
			for (let e of u.reverse()) try {
				e();
			} catch (e) {
				t ??= e;
			}
			if (u.length = 0, d.clear(), f.clear(), r = null, t !== void 0) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", t);
			return !0;
		},
		navigation: le,
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
//#region src/app/tab-state.ts
var Nt = Object.freeze([
	"playing",
	"muted",
	"blocked"
]), Pt = Object.freeze([
	"blue",
	"cyan",
	"gray",
	"green",
	"orange",
	"pink",
	"purple",
	"red",
	"violet",
	"yellow"
]);
new Set(Nt);
var Ft = new Set(Pt);
function It(e) {
	return typeof e == "string" && Ft.has(e);
}
//#endregion
//#region src/firefox/tabs.ts
var Lt = Object.freeze([
	"TabOpen",
	"TabClose",
	"TabSelect",
	"TabMove",
	"TabPinned",
	"TabUnpinned",
	"TabAttrModified"
]), Rt = new Set([
	"activemedia-blocked",
	"attention",
	"busy",
	"image",
	"label",
	"muted",
	"pictureinpicture",
	"selected",
	"soundplaying",
	"usercontextid"
]), zt = 262144, Bt = 1e5, Vt = "resource://gre/modules/ContextualIdentityService.sys.mjs", Ht = /[\s"'<>\\]/u, Ut = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, Wt = Object.freeze({
	toolbar: "gray",
	turquoise: "cyan"
}), Gt = (e) => typeof e == "object" && !!e || typeof e == "function", q = (e) => typeof e == "object" && !!e, Kt = (e) => typeof e == "function", qt = (e) => e.gBrowser, Jt = (e, t) => {
	let n = qt(e);
	return q(n) ? n[t] : void 0;
}, Yt = (e, t) => {
	let n = e.document;
	if (!(!q(n) || !Kt(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Xt = (e) => q(e) && Kt(e.openPopup) && Kt(e.moveTo) && Kt(e.addEventListener) && Kt(e.removeEventListener), Zt = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => Jt(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: Gt,
		name: "firefox.selected-tab",
		read: (e) => Jt(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab"
	}),
	...[
		["add-tab", "addTrustedTab"],
		["remove-tab", "removeTab"],
		["pin-tab", "pinTab"],
		["unpin-tab", "unpinTab"],
		["move-tab", "moveTabTo"]
	].map(([e, t]) => Object.freeze({
		isAvailable: Kt,
		name: `firefox.${e}`,
		read: (e) => Jt(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: (e) => typeof e == "string" && e.length > 0 && e.length <= 2048,
		name: "firefox.new-tab-url",
		read: (e) => e.BROWSER_NEW_TAB_URL,
		symbol: "window.BROWSER_NEW_TAB_URL"
	}),
	Object.freeze({
		isAvailable: Xt,
		name: "firefox.tab-context-menu",
		read: (e) => Yt(e, "tabContextMenu"),
		symbol: "document.tabContextMenu.openPopup.moveTo"
	})
]), Qt = (e) => Object.freeze(Zt.map((t) => {
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
})), $t = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, J = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: $t(e),
	phase: n,
	symbol: r
}), en = (e, t) => {
	if (!q(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw J(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, tn = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !Ht.test(e) || e.length <= zt && Ut.test(e))) return e;
}, nn = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl && e.audio === r.audio && e.attention === r.attention && e.pictureInPicture === r.pictureInPicture && e.container?.color === r.container?.color && e.container?.label === r.container?.label;
}), rn = (e) => {
	if (!q(e) || !q(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Rt.has(e));
}, an = (e) => {
	if (typeof e != "string" || e.length === 0) return;
	let t = Wt[e] ?? e;
	return It(t) ? t : void 0;
}, on = (e, t) => !q(e) || e.target === void 0 || e.target === t || q(e.target) && e.target.id === "tabContextMenu";
function sn({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !q(r) || typeof n != "function") throw J(e, "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID", "firefox-tabs-create", "window");
	let i = r, a = !1, o = null, s = 0, c = Object.freeze([]), l = new Set(), u = new Set(), d = [], f = e.createHandleRegistry("tab"), p = null, m = null;
	if (typeof t == "function") try {
		let e = t(Vt), n = q(e) ? e.ContextualIdentityService : void 0;
		q(n) && Kt(n.getPublicIdentityFromId) && (p = n);
	} catch {
		p = null;
	}
	let h = () => {
		if (a || !i) throw J(e, "FENNEVIA_FIREFOX_TABS_DISPOSED", "firefox-tabs-access", "window.gBrowser.openTabs");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, g = () => {
		let t = h().gBrowser;
		if (!q(t)) throw J(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "window.gBrowser");
		return t;
	}, v = () => {
		let t = Qt(h()), n = t.find((e) => !e.snapshot.available);
		if (n) throw J(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, y = () => {
		let t = g().openTabs;
		if (!Array.isArray(t)) throw J(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = t.map((t) => en(e, t));
		if (new Set(n).size !== n.length) throw J(e, "FENNEVIA_FIREFOX_TAB_ORDER_INVALID", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		return n;
	}, x = (e, t) => Reflect.apply(e.getAttribute, e, [t]), S = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), C = (e) => {
		if (S(e, "activemedia-blocked")) return "blocked";
		if (S(e, "muted")) return "muted";
		if (S(e, "soundplaying")) return "playing";
	}, w = (e) => {
		if (!p) return;
		let t = Number.parseInt(String(x(e, "usercontextid") ?? ""), 10);
		if (!Number.isSafeInteger(t) || t <= 0) return;
		let n;
		try {
			n = Reflect.apply(p.getPublicIdentityFromId, p, [t]);
		} catch {
			return;
		}
		if (!q(n)) return;
		let r = an(n.color);
		if (!r) return;
		let i = "";
		if (typeof n.name == "string" && (i = n.name), i.trim().length === 0 && Kt(p.getUserContextLabel)) try {
			let e = Reflect.apply(p.getUserContextLabel, p, [t]);
			typeof e == "string" && (i = e);
		} catch {
			i = "";
		}
		let a = i.trim();
		return Object.freeze({
			color: r,
			label: (a.length === 0 ? "Container" : a).slice(0, 80)
		});
	}, T = (e, t) => {
		let n = String(x(e, "label") ?? "").slice(0, 256), r = tn(x(e, "image")), i = C(e), a = w(e);
		return Object.freeze({
			...S(e, "attention") ? { attention: !0 } : {},
			...i === void 0 ? {} : { audio: i },
			...a === void 0 ? {} : { container: a },
			...r === void 0 ? {} : { faviconUrl: r },
			...S(e, "pictureinpicture") ? { pictureInPicture: !0 } : {},
			id: f.register(e),
			loading: S(e, "busy"),
			pinned: S(e, "pinned"),
			selected: t === e,
			title: n
		});
	}, E = (t) => {
		for (let r of Array.from(u)) try {
			r(t);
		} catch (t) {
			n(J(e, "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED", "firefox-tabs-notify", "tabs.subscribe", t));
		}
	}, D = () => {
		E(Object.freeze({
			revision: s,
			tabs: c,
			type: "snapshot"
		}));
	}, O = (e) => {
		let t = g(), n = y().map((e) => T(e, t.selectedTab)), r = new Set(n.map((e) => e.id));
		for (let e of Array.from(l)) r.has(e) || (f.release(e), l.delete(e));
		for (let e of r) l.add(e);
		let i = Object.freeze(n);
		return !nn(c, i) && (c = i, s += 1, e && D(), !0);
	}, k = (t, r) => {
		o = _(t) ? t : J(e, "FENNEVIA_FIREFOX_TABS_EVENT_FAILED", "firefox-tabs-event", `window.gBrowser.tabContainer.${r}`, t), n(o);
	}, A = (t) => {
		h();
		let n = f.resolve(t);
		if (!y().includes(n)) throw f.release(t), l.delete(t), J(e, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-action", "tab.opaque-id");
		return n;
	}, ee = (t, n) => {
		let r = g(), i = r[t];
		if (typeof i != "function") throw J(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", `window.gBrowser.${t}`);
		return Reflect.apply(i, r, n);
	}, te = (t) => {
		if (t === void 0) return Object.freeze({ selected: !0 });
		if (!q(t) || Object.keys(t).some((e) => e !== "selected") || t.selected !== void 0 && typeof t.selected != "boolean") throw J(e, "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID", "firefox-tabs-action", "tabs.open.options");
		return Object.freeze({ selected: t.selected ?? !0 });
	}, j = (t) => {
		if (!q(t) || Object.keys(t).some((e) => e !== "screenX" && e !== "screenY") || typeof t.screenX != "number" || typeof t.screenY != "number" || !Number.isFinite(t.screenX) || !Number.isFinite(t.screenY) || Math.abs(t.screenX) > Bt || Math.abs(t.screenY) > Bt) throw J(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POINT_INVALID", "firefox-tabs-action", "tabs.openContextMenu.point");
		return Object.freeze({
			screenX: t.screenX,
			screenY: t.screenY
		});
	}, M = () => {
		if (h(), !m || !Xt(m)) throw J(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
		return m;
	}, ne = Object.freeze({
		close(e) {
			let t = A(e);
			ee("removeTab", [t, {
				animate: !0,
				isUserTriggered: !0
			}]), O(!0);
		},
		move(t, n) {
			let r = A(t);
			if (!Number.isSafeInteger(n) || n < 0 || n > 1e4) throw J(e, "FENNEVIA_FIREFOX_TAB_MOVE_INDEX_INVALID", "firefox-tabs-action", "tabs.move.index");
			ee("moveTabTo", [r, {
				isUserTriggered: !0,
				tabIndex: n
			}]), O(!0);
		},
		open(t) {
			let n = te(t), r = h().BROWSER_NEW_TAB_URL;
			if (typeof r != "string" || r.length === 0) throw J(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.BROWSER_NEW_TAB_URL");
			let i = en(e, ee("addTrustedTab", [r, { inBackground: !n.selected }]));
			if (!y().includes(i)) throw J(e, "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED", "firefox-tabs-action", "window.gBrowser.addTrustedTab");
			let a = f.register(i);
			if (O(!0), n.selected && g().selectedTab !== i) throw J(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			return a;
		},
		openContextMenu(t, r) {
			let i = A(t), a = j(r), o = M(), s = o.openPopup, c = o.moveTo;
			if (!Kt(s) || !Kt(c)) throw J(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
			try {
				Reflect.apply(s, o, [
					i,
					"after_start",
					0,
					0,
					!0
				]);
			} catch (t) {
				throw J(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_REJECTED", "firefox-tabs-action", "document.tabContextMenu.openPopup", t);
			}
			try {
				Reflect.apply(c, o, [a.screenX, a.screenY]);
			} catch (t) {
				n(J(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POSITION_FAILED", "firefox-tabs-action", "document.tabContextMenu.moveTo", t));
			}
		},
		pin(t) {
			let n = A(t);
			if (!S(n, "pinned")) {
				if (ee("pinTab", [n]), !S(n, "pinned")) throw J(e, "FENNEVIA_FIREFOX_TAB_PIN_REJECTED", "firefox-tabs-action", "window.gBrowser.pinTab");
				O(!0);
			}
		},
		select(t) {
			let n = A(t), r = g();
			if (r.selectedTab !== n) {
				if (!Reflect.set(r, "selectedTab", n) || r.selectedTab !== n) throw J(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
				O(!0);
			}
		},
		snapshot() {
			return h(), c;
		},
		subscribe(t) {
			if (h(), typeof t != "function") throw J(e, "FENNEVIA_FIREFOX_TABS_LISTENER_INVALID", "firefox-tabs-subscribe", "tabs.subscribe");
			return u.add(t), b(() => {
				u.delete(t);
			});
		},
		toggleMute(t) {
			let n = A(t), r = n.toggleMuteAudio;
			if (!Kt(r)) throw J(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "MozTabbrowserTab.toggleMuteAudio");
			Reflect.apply(r, n, []), O(!0);
		},
		unpin(t) {
			let n = A(t);
			if (S(n, "pinned")) {
				if (ee("unpinTab", [n]), S(n, "pinned")) throw J(e, "FENNEVIA_FIREFOX_TAB_UNPIN_REJECTED", "firefox-tabs-action", "window.gBrowser.unpinTab");
				O(!0);
			}
		}
	});
	try {
		e.assertRequiredCapabilities(), v(), O(!1);
		let t = g().tabContainer;
		for (let n of Lt) d.push(e.subscribe(t, n, (e) => {
			if (!(a || o)) try {
				if (n === "TabAttrModified" && !rn(e)) return;
				O(!0);
			} catch (e) {
				k(e, n);
			}
		}));
		let n = Yt(h(), "tabContextMenu");
		if (!Xt(n)) throw J(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "document.tabContextMenu.openPopup.moveTo");
		m = n, d.push(e.subscribe(n, "popupshown", (e) => {
			a || o || !on(e, n) || E(Object.freeze({
				open: !0,
				type: "context-menu"
			}));
		})), d.push(e.subscribe(n, "popuphidden", (e) => {
			a || !on(e, n) || E(Object.freeze({
				open: !1,
				type: "context-menu"
			}));
		}));
	} catch (t) {
		a = !0, i = null;
		let r;
		for (let e of d.reverse()) try {
			e();
		} catch (e) {
			r ??= e;
		}
		try {
			f.dispose();
		} catch (e) {
			r ??= e;
		}
		throw r !== void 0 && n(J(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", r)), t;
	}
	return Object.freeze({
		assertRequiredCapabilities: v,
		dispose() {
			if (a) return !1;
			a = !0, i = null;
			let t, n = m?.hidePopup;
			if (m && Kt(n)) try {
				Reflect.apply(n, m, []);
			} catch (e) {
				t ??= e;
			}
			m = null, p = null;
			for (let e of d.reverse()) try {
				e();
			} catch (e) {
				t ??= e;
			}
			d.length = 0, u.clear(), l.clear(), c = Object.freeze([]);
			try {
				f.dispose();
			} catch (e) {
				t ??= e;
			}
			if (t !== void 0) throw J(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", t);
			return !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: a,
				failed: o !== null,
				revision: s,
				subscriberCount: u.size,
				tabCount: c.length
			});
		},
		tabs: ne
	});
}
//#endregion
//#region src/app/toolbar-widgets-state.ts
var cn = Object.freeze([
	"built-in",
	"extension-action",
	"fennevia",
	"separator",
	"spacer",
	"spring"
]), ln = Object.freeze([
	"top",
	"left",
	"right",
	"bottom"
]), un = Object.freeze(["show-bookmarks", "show-downloads"]), dn = Object.freeze([
	"built-in",
	"extension-action",
	"fennevia",
	"special"
]), fn = Object.freeze([
	"auto",
	"light",
	"dark"
]), pn = Object.freeze([
	"compact",
	"cozy",
	"comfortable"
]), mn = Object.freeze({
	blur: Object.freeze({
		max: 32,
		min: 0
	}),
	fontSize: Object.freeze({
		max: 14,
		min: 11
	}),
	radius: Object.freeze({
		max: 16,
		min: 0
	}),
	surfaceOpacity: Object.freeze({
		max: 100,
		min: 50
	})
}), hn = /^#[0-9a-f]{6}$/u, gn = 48, _n = /^[a-z][a-z0-9-]{0,63}$/u;
new Set(cn);
var vn = new Set(ln), yn = new Set(un);
new Set(dn);
var bn = new Set(fn), xn = new Set(pn), Sn = Object.freeze([
	"separator",
	"spacer",
	"spring"
]);
new Set(Sn);
var Cn = (e) => {
	let t = Error(e);
	return t.name = "FenneviaToolbarWidgetsStateError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "toolbar-widgets-state"
		}
	}), t;
};
function wn(e) {
	return typeof e == "string" && vn.has(e);
}
function Tn(e) {
	return typeof e == "string" && yn.has(e);
}
function En(e) {
	return typeof e == "string" && bn.has(e);
}
function Dn(e) {
	return typeof e == "string" && xn.has(e);
}
function On() {
	return Object.freeze({
		accent: "",
		blur: 18,
		density: "cozy",
		fontSize: 12,
		radius: 4,
		surfaceOpacity: 94,
		theme: "auto"
	});
}
var kn = (e, t) => typeof e == "number" && Number.isSafeInteger(e) && e >= t.min && e <= t.max, An = (e) => typeof e == "string" && (e === "" || hn.test(e));
function jn(e) {
	if (!e || typeof e != "object" || !An(e.accent) || !kn(e.blur, mn.blur) || !Dn(e.density) || !kn(e.fontSize, mn.fontSize) || !kn(e.radius, mn.radius) || !kn(e.surfaceOpacity, mn.surfaceOpacity) || !En(e.theme)) throw Cn("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	return Object.freeze({
		accent: e.accent,
		blur: e.blur,
		density: e.density,
		fontSize: e.fontSize,
		radius: e.radius,
		surfaceOpacity: e.surfaceOpacity,
		theme: e.theme
	});
}
function Mn(e) {
	if (!e || typeof e != "object") throw Cn("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = jn({
		...On(),
		...e
	}), n = Object.keys(e);
	if (n.length === 0 || n.some((e) => !(e in t)) || n.some((n) => e[n] !== t[n])) throw Cn("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let r = {};
	for (let e of n) {
		let n = e;
		Object.assign(r, { [n]: t[n] });
	}
	return Object.freeze(r);
}
function Nn() {
	return Object.freeze({
		bottom: Object.freeze([]),
		left: Object.freeze([]),
		right: Object.freeze([]),
		top: Object.freeze([])
	});
}
function Pn() {
	return Object.freeze({
		available: !1,
		canEdit: !1,
		layoutCustomized: !1,
		palette: Object.freeze([]),
		style: On(),
		zones: Nn()
	});
}
var Fn = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0 && e <= gn, In = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
function Ln(e) {
	if (!e || typeof e != "object") throw Cn("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	switch (e.type) {
		case "add":
			if (typeof e.token != "string" || !_n.test(e.token) || !wn(e.zone) || !Fn(e.index) || !In(e.revision)) throw Cn("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				token: e.token,
				type: "add",
				zone: e.zone
			});
		case "move":
			if (!wn(e.fromZone) || !wn(e.toZone) || !Fn(e.fromIndex) || !Fn(e.toIndex) || !In(e.revision)) throw Cn("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				fromIndex: e.fromIndex,
				fromZone: e.fromZone,
				revision: e.revision,
				toIndex: e.toIndex,
				toZone: e.toZone,
				type: "move"
			});
		case "remove":
			if (!wn(e.zone) || !Fn(e.index) || !In(e.revision)) throw Cn("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				type: "remove",
				zone: e.zone
			});
		case "reset-layout":
			if (!In(e.revision)) throw Cn("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				revision: e.revision,
				type: "reset-layout"
			});
		case "set-style": return Object.freeze({
			style: Mn(e.style),
			type: "set-style"
		});
		case "reset-style": return Object.freeze({ type: "reset-style" });
		default: throw Cn("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	}
}
//#endregion
//#region src/firefox/customize-model.ts
var Rn = Object.freeze([
	"separator",
	"spacer",
	"spring"
]), zn = new Set(Rn), Bn = Object.freeze({
	adoptedMaxEntries: 64,
	serializedMaxLength: 16384,
	widgetIdMaxLength: 128,
	zoneMaxEntries: 48
}), Vn = /^[A-Za-z0-9_.-]{1,128}$/u;
function Y(e) {
	let t = Error(e);
	return t.name = "FenneviaCustomizeModelError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "customize-model"
		}
	}), t;
}
function Hn(e) {
	return typeof e == "string" && zn.has(e);
}
function Un(e) {
	return typeof e == "string" && Vn.test(e);
}
function Wn(e) {
	if (!e || typeof e != "object") throw Y("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	let t = e;
	if (t.type === "widget" && Un(t.id)) return Object.freeze({
		id: t.id,
		type: "widget"
	});
	if (t.type === "special" && Hn(t.kind)) return Object.freeze({
		kind: t.kind,
		type: "special"
	});
	if (t.type === "fennevia" && Tn(t.id)) return Object.freeze({
		id: t.id,
		type: "fennevia"
	});
	throw Y("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
}
function Gn(e) {
	if (!e || typeof e != "object") throw Y("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e, n = [];
	for (let e of ln) {
		let r = t[e];
		if (!Array.isArray(r) || r.length > Bn.zoneMaxEntries) throw Y("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
		n.push([e, Object.freeze(r.map(Wn))]);
	}
	return Object.freeze(Object.fromEntries(n));
}
function Kn(e) {
	if (!e || typeof e != "object") throw Y("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e;
	if (t.version !== 1 || !Array.isArray(t.adopted) || t.adopted.length > Bn.adoptedMaxEntries || t.adopted.some((e) => !Un(e))) throw Y("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	return Object.freeze({
		adopted: Object.freeze([...t.adopted]),
		version: 1,
		zones: Gn(t.zones)
	});
}
function qn() {
	return Object.freeze({
		adopted: Object.freeze([]),
		version: 1,
		zones: Object.freeze({
			bottom: Object.freeze([]),
			left: Object.freeze([]),
			right: Object.freeze([]),
			top: Object.freeze([])
		})
	});
}
function Jn(e, t = []) {
	return Kn({
		adopted: t,
		version: 1,
		zones: {
			...qn().zones,
			...e
		}
	});
}
function Yn(e) {
	if (typeof e != "string" || e === "" || e.length > Bn.serializedMaxLength) return null;
	try {
		return Kn(JSON.parse(e));
	} catch {
		return null;
	}
}
function Xn(e) {
	let t = JSON.stringify(Kn(e));
	if (t.length > Bn.serializedMaxLength) throw Y("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return t;
}
function Zn(e) {
	if (typeof e != "string" || e === "" || e.length > Bn.serializedMaxLength) return null;
	try {
		let t = JSON.parse(e);
		return !t || typeof t != "object" || t.version !== 1 ? null : jn({
			...On(),
			...t,
			version: void 0
		});
	} catch {
		return null;
	}
}
function Qn(e) {
	return JSON.stringify({
		...jn(e),
		version: 1
	});
}
function $n(e, t) {
	if (t.type === "special") return null;
	for (let n of ln) {
		let r = e.zones[n];
		for (let [e, i] of r.entries()) if (i.type === t.type && i.id === t.id) return Object.freeze({
			index: e,
			zone: n
		});
	}
	return null;
}
var er = (e) => {
	if (!wn(e)) throw Y("FENNEVIA_CUSTOMIZE_MODEL_ZONE_INVALID");
	return e;
}, tr = (e, t) => {
	if (!Number.isSafeInteger(e) || e < 0) throw Y("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return Math.min(e, t);
}, nr = (e, t, n) => Object.freeze({
	adopted: e.adopted,
	version: 1,
	zones: Object.freeze({
		...e.zones,
		[t]: Object.freeze([...n])
	})
});
function rr(e, t, n, r) {
	let i = Wn(t), a = er(n), o = $n(e, i), s = e;
	o && (s = ir(e, o.zone, o.index));
	let c = [...s.zones[a]];
	if (c.length >= Bn.zoneMaxEntries) throw Y("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return c.splice(tr(r, c.length), 0, i), nr(s, a, c);
}
function ir(e, t, n) {
	let r = er(t), i = [...e.zones[r]];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw Y("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i.splice(n, 1), nr(e, r, i);
}
function ar(e, t, n) {
	let r = er(t), i = e.zones[r];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw Y("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i[n];
}
function or(e, t, n, r, i) {
	let a = ar(e, t, n), o = ir(e, t, n), s = [...o.zones[er(r)]];
	if (s.length >= Bn.zoneMaxEntries) throw Y("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return s.splice(tr(i, s.length), 0, a), nr(o, r, s);
}
function sr(e, t) {
	if (!Un(t)) throw Y("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	if (e.adopted.includes(t)) return e;
	if (e.adopted.length >= Bn.adoptedMaxEntries) throw Y("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return Object.freeze({
		adopted: Object.freeze([...e.adopted, t]),
		version: 1,
		zones: e.zones
	});
}
function cr(e, t) {
	return e.adopted.includes(t) ? Object.freeze({
		adopted: Object.freeze(e.adopted.filter((e) => e !== t)),
		version: 1,
		zones: e.zones
	}) : e;
}
function lr(e, t) {
	return $n(e, {
		id: t,
		type: "widget"
	}) !== null;
}
//#endregion
//#region src/firefox/toolbar-widgets.ts
var ur = "nav-bar", dr = "unified-extensions-area", fr = "fennevia.customize.layout", pr = "fennevia.customize.style", mr = "fennevia.customize.", hr = 16384, gr = 256, _r = "customizationui-widget-panel", vr = 800, yr = "after_start", br = 200, xr = 300, Sr = 8, Cr = 512, wr = Object.freeze({ capture: !0 }), Tr = /^rgba?\([0-9\s.,%]{1,48}\)$/u, Er = /url\("((?:[^"\\]|\\.){1,512})"\)/u, Dr = "moz-extension://", Or = "-browser-action", kr = Object.freeze([
	"back-button",
	"forward-button",
	"stop-reload-button",
	"home-button",
	"urlbar-container",
	"search-container",
	"downloads-button",
	"personal-bookmarks",
	"menubar-items",
	"tabbrowser-tabs"
]), Ar = new Set(kr), jr = new Map([
	["bookmarks-menu-button", "bookmark"],
	["developer-button", "developer"],
	["edit-controls", "edit"],
	["firefox-view-button", "firefox-view"],
	["fullscreen-button", "fullscreen"],
	["fxa-toolbar-menu-button", "account"],
	["history-panelmenu", "history"],
	["ipprotection-button", "shield"],
	["library-button", "library"],
	["new-window-button", "new-window"],
	["print-button", "print"],
	["privatebrowsing-button", "private"],
	["reset-pbm-toolbar-button", "private"],
	["screenshot-button", "screenshot"],
	["sidebar-button", "sidebar"],
	["zoom-controls", "zoom"]
]), Mr = new Map([["show-bookmarks", Object.freeze({
	icon: "bookmark",
	label: "Show bookmarks panel",
	tooltip: "Reveal the Fennevia bookmarks panel"
})], ["show-downloads", Object.freeze({
	icon: "download",
	label: "Show downloads panel",
	tooltip: "Reveal the Fennevia downloads panel"
})]]), X = (e) => typeof e == "object" && !!e, Z = (e) => typeof e == "function", Nr = (e) => X(e) && Z(e.getAttribute), Pr = (e) => X(e) && Z(e.hidePopup) && Z(e.moveToAnchor), Fr = (e, t) => typeof e == "string" ? e.slice(0, t) : "", Ir = (e) => {
	let t = e.trim();
	return Tr.test(t) ? t : "";
}, Lr = (e) => {
	let t = e.CustomizableUI;
	return !X(t) || !Z(t.getWidgetIdsInArea) || !Z(t.getWidget) || !Z(t.addListener) || !Z(t.removeListener) ? null : t;
}, Rr = (e) => {
	let t = e.Services;
	if (!X(t)) return null;
	let n = t.prefs;
	return !X(n) || !Z(n.addObserver) || !Z(n.clearUserPref) || !Z(n.getStringPref) || !Z(n.removeObserver) || !Z(n.setStringPref) ? null : n;
}, zr = (e, t) => {
	try {
		let n = Reflect.apply(e.getStringPref, e, [t, ""]);
		return typeof n == "string" && n.length <= hr ? n : "";
	} catch {
		return "";
	}
}, Br = (e) => {
	try {
		let t = e.AREA_ADDONS;
		return typeof t == "string" && t !== "" ? t : dr;
	} catch {
		return dr;
	}
}, Vr = (e, t) => {
	if (Z(e.isWebExtensionWidget)) try {
		return Reflect.apply(e.isWebExtensionWidget, e, [t]) === !0;
	} catch {}
	return t.endsWith(Or);
}, Hr = (e) => {
	let t = e.PanelUI;
	return !X(t) || !Z(t.showSubView) ? null : t.showSubView;
}, Ur = Object.freeze([
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.customizable-ui",
		read: (e) => Lr(e),
		requirement: "optional",
		symbol: "window.CustomizableUI.getWidgetIdsInArea.getWidget.addListener.removeListener"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.panel-ui-sub-view",
		read: (e) => Hr(e),
		requirement: "optional",
		symbol: "window.PanelUI.showSubView"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.prefs",
		read: (e) => Rr(e),
		requirement: "optional",
		symbol: "window.Services.prefs.getStringPref.setStringPref.clearUserPref.addObserver.removeObserver"
	}),
	Object.freeze({
		isAvailable: (e) => X(e) && Z(e.addEventListener) && Z(e.removeEventListener) && Z(e.getElementById),
		name: "toolbar-widgets.document-events",
		read: (e) => e.document,
		requirement: "required",
		symbol: "document.addEventListener.removeEventListener.getElementById"
	})
]), Wr = (e) => Object.freeze(Ur.map((t) => {
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
})), Gr = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Q = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Gr(e),
	phase: n,
	symbol: r
}), Kr = (e) => {
	if (e.startsWith("customizableui-special-")) {
		let t = /^customizableui-special-(spring|spacer|separator)/u.exec(e);
		return t ? t[1] : null;
	}
	return e === "spring" || e === "spacer" || e === "separator" ? e : e === "vertical-spacer" ? "spacer" : null;
}, qr = (e, t) => {
	if (!e) return "";
	try {
		let n = e[t];
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, Jr = (e, t) => {
	let n = e.document;
	if (!(!X(n) || !Z(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Yr = (e, t) => {
	if (Z(e.querySelector)) try {
		return Reflect.apply(e.querySelector, e, [t]);
	} catch {
		return;
	}
}, Xr = (e, t) => {
	try {
		let n = Reflect.apply(e.getAttribute, e, [t]);
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, Zr = (e) => e.isConnected === !0, Qr = (e) => {
	let t = Yr(e, ".unified-extensions-item-action-button");
	return Nr(t) ? t : null;
}, $r = (e) => {
	let t = "", n = e.style;
	if (X(n) && Z(n.getPropertyValue)) try {
		let e = Reflect.apply(n.getPropertyValue, n, ["--webextension-toolbar-image"]);
		typeof e == "string" && (t = e);
	} catch {
		t = "";
	}
	t ||= Xr(e, "style");
	let r = Er.exec(t);
	if (!r) return "";
	let i = r[1].replace(/\\(.)/gu, "$1");
	return !i.startsWith(Dr) || i.length > Cr ? "" : i;
}, ei = (e) => {
	let t = Fr(Xr(e, "badge"), Sr), n = "", r = "", i = Xr(e, "badgeStyle"), a = /background-color:\s*([^;]{1,64})/u.exec(i);
	a && (n = Ir(a[1]));
	let o = /(?:^|;)\s*color:\s*([^;]{1,64})/u.exec(i);
	return o && (r = Ir(o[1])), Object.freeze({
		background: n,
		text: t,
		textColor: r
	});
}, ti = (e) => {
	let t = Yr(e, ".unified-extensions-item-name");
	if (X(t) && typeof t.textContent == "string") {
		let e = t.textContent.trim();
		if (e) return Fr(e, br);
	}
	return "";
}, ni = (e) => e.disabled === !0 || Xr(e, "disabled") === "true";
function ri({ boundary: e, frame: t, window: n }) {
	if (e.assertOwnsWindow(n), !X(n) || !X(t) || typeof t.contains != "function") throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_OPTIONS_INVALID", "firefox-toolbar-widgets-create", "window");
	let r = (e) => Reflect.apply(t.contains, t, [e]) === !0, i = n, a = !1, o = 0, s = 0, c = !1, l = !1, u = !1, d = "", f = Pn(), p = null, m = On(), h = 0, g = new Map(), v = new Map(), y = null, b = null, x = "", S = null, C = "", w = null, T = new Set(), E = [], D = new Set(), O = new Set(), k = e.createHandleRegistry("toolbar-widget"), A = () => {
		if (a || !i) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_DISPOSED", "firefox-toolbar-widgets-access", "window");
		return i;
	}, ee = () => {
		let t = Wr(A()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, te = (t) => {
		let n = A();
		if (!X(t) || !Z(t.getBoundingClientRect) || t.ownerDocument !== n.document || r(t) !== !0) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HOST_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.host");
		return t;
	}, j = e.snapshot().windowKind === "private", M = (e, t) => {
		try {
			let n = Reflect.apply(e.getWidget, e, [t]);
			return X(n) ? n : null;
		} catch {
			return null;
		}
	}, ne = (e) => Object.freeze({
		badgeBackground: "",
		badgeText: "",
		badgeTextColor: "",
		disabled: !1,
		fenneviaAction: "",
		handle: "",
		icon: "",
		iconUrl: "",
		kind: e,
		label: "",
		missing: !1,
		tooltip: ""
	}), re = (e) => {
		let t = Mr.get(e);
		return Object.freeze({
			badgeBackground: "",
			badgeText: "",
			badgeTextColor: "",
			disabled: !1,
			fenneviaAction: e,
			handle: "",
			icon: t?.icon ?? "generic",
			iconUrl: "",
			kind: "fennevia",
			label: t?.label ?? "Fennevia control",
			missing: !1,
			tooltip: t?.tooltip ?? t?.label ?? ""
		});
	}, N = (e, t) => {
		let n = M(e, t), r = n?.webExtension === !0 || Vr(e, t), i = Fr(qr(n, "label"), br) || (r ? "Extension" : "Toolbar item");
		return Object.freeze({
			badgeBackground: "",
			badgeText: "",
			badgeTextColor: "",
			disabled: !0,
			fenneviaAction: "",
			handle: "",
			icon: r ? "extension" : jr.get(t) ?? "generic",
			iconUrl: "",
			kind: r ? "extension-action" : "built-in",
			label: i,
			missing: !0,
			tooltip: i
		});
	}, ie = (e, t) => {
		let n = Jr(A(), t);
		if (!Nr(n) || !Zr(n)) return Object.freeze({
			node: null,
			widget: N(e, t)
		});
		let r = M(e, t), i = r?.webExtension === !0 || Vr(e, t), a = k.register(n), o = Xr(n, "label"), s = qr(r, "label"), c = Xr(n, "tooltiptext"), l = qr(r, "tooltiptext");
		if (i) {
			let e = Qr(n), t = e ? ei(e) : Object.freeze({
				background: "",
				text: "",
				textColor: ""
			}), r = ti(n) || Fr(s || o, br) || "Extension";
			return Object.freeze({
				node: n,
				widget: Object.freeze({
					badgeBackground: t.background,
					badgeText: t.text,
					badgeTextColor: t.textColor,
					disabled: ni(e || n),
					fenneviaAction: "",
					handle: a,
					icon: "extension",
					iconUrl: e ? $r(e) : "",
					kind: "extension-action",
					label: r,
					missing: !1,
					tooltip: Fr(l || c, xr) || r
				})
			});
		}
		let u = Fr(o || s, br) || Fr(c || l, br) || "Toolbar item";
		return Object.freeze({
			node: n,
			widget: Object.freeze({
				badgeBackground: "",
				badgeText: "",
				badgeTextColor: "",
				disabled: ni(n),
				fenneviaAction: "",
				handle: a,
				icon: jr.get(t) ?? "generic",
				iconUrl: "",
				kind: "built-in",
				label: u,
				missing: !1,
				tooltip: Fr(c || l || u, xr)
			})
		});
	}, P = (e, t) => t.type === "special" ? Object.freeze({
		node: null,
		widget: ne(t.kind)
	}) : t.type === "fennevia" ? Object.freeze({
		node: null,
		widget: re(t.id)
	}) : ie(e, t.id), ae = (e) => {
		let t;
		try {
			t = Reflect.apply(e.getWidgetIdsInArea, e, [ur]);
		} catch {
			t = null;
		}
		let n = [];
		if (Array.isArray(t)) for (let e of t) {
			if (typeof e != "string" || Ar.has(e)) continue;
			let t = Kr(e);
			if (t) {
				n.push(Object.freeze({
					kind: t,
					type: "special"
				}));
				continue;
			}
			Un(e) && n.push(Object.freeze({
				id: e,
				type: "widget"
			}));
		}
		return Jn({ top: n });
	}, oe = (e) => {
		let t = g.get(e);
		if (t) return t;
		let n = `palette-${++h}`;
		return g.set(e, n), n;
	}, se = (e) => {
		let t;
		try {
			t = e.areas;
		} catch {
			t = void 0;
		}
		let n = Array.isArray(t) ? t : [ur], r = [], i = new Set();
		for (let t of n) {
			if (typeof t != "string") continue;
			let n;
			try {
				n = Reflect.apply(e.getWidgetIdsInArea, e, [t]);
			} catch {
				continue;
			}
			if (Array.isArray(n)) for (let e of n) typeof e == "string" && !i.has(e) && (i.add(e), r.push(e));
		}
		return r;
	}, ce = (e) => {
		if (!Z(e.getUnusedWidgets)) return [];
		let t = i?.gNavToolbox, n = X(t) ? t.palette : void 0;
		if (!X(n)) return [];
		try {
			let t = Reflect.apply(e.getUnusedWidgets, e, [n]);
			if (!Array.isArray(t)) return [];
			let r = [];
			for (let e of t) X(e) && typeof e.id == "string" && r.push(e.id);
			return r;
		} catch {
			return [];
		}
	}, le = (e, t) => {
		if (Ar.has(t) || Kr(t) !== null || !Un(t)) return null;
		let n = M(e, t);
		if (j && n?.showInPrivateBrowsing === !1) return null;
		let r = n?.webExtension === !0 || Vr(e, t), i = Jr(A(), t), a = Nr(i) && Zr(i) ? i : null, o, s = "";
		if (r) {
			let e = a ? Qr(a) : null;
			s = e ? $r(e) : "", o = (a ? ti(a) : "") || Fr(qr(n, "label"), br) || "Extension";
		} else o = Fr((a ? Xr(a, "label") : "") || qr(n, "label"), br) || Fr((a ? Xr(a, "tooltiptext") : "") || qr(n, "tooltiptext"), br) || "Toolbar item";
		let c = oe(`w:${t}`);
		return v.set(c, Object.freeze({
			id: t,
			type: "widget"
		})), Object.freeze({
			icon: r ? "extension" : jr.get(t) ?? "generic",
			iconUrl: s,
			kind: r ? "extension-action" : "built-in",
			label: o,
			token: c
		});
	}, ue = (e, t) => {
		v.clear();
		let n = [], r = new Set(), i = new Set();
		for (let e of ln) for (let n of t.zones[e]) n.type === "widget" ? r.add(n.id) : n.type === "fennevia" && i.add(n.id);
		for (let e of un) {
			if (i.has(e)) continue;
			let t = Mr.get(e), r = oe(`f:${e}`);
			v.set(r, Object.freeze({
				id: e,
				type: "fennevia"
			})), n.push(Object.freeze({
				icon: t?.icon ?? "generic",
				iconUrl: "",
				kind: "fennevia",
				label: t?.label ?? "Fennevia control",
				token: r
			}));
		}
		let a = [...se(e), ...ce(e)], o = new Set();
		for (let t of a) {
			if (o.has(t) || r.has(t) || n.length >= gr) continue;
			o.add(t);
			let i = le(e, t);
			i && n.push(i);
		}
		for (let [e, t] of [
			["separator", "Separator"],
			["spacer", "Space"],
			["spring", "Flexible space"]
		]) {
			let r = oe(`s:${e}`);
			v.set(r, Object.freeze({
				kind: e,
				type: "special"
			})), n.push(Object.freeze({
				icon: "",
				iconUrl: "",
				kind: "special",
				label: t,
				token: r
			}));
		}
		return Object.freeze(n);
	}, de = (e) => {
		if (X(y) && Z(y.disconnect)) try {
			Reflect.apply(y.disconnect, y, []);
		} catch {}
		y = null;
		let t = i;
		if (!t) return;
		let n = t.MutationObserver;
		if (Z(n)) try {
			let t = Reflect.construct(n, [() => {
				F();
			}]);
			if (!Z(t.observe)) return;
			for (let n of e) n && Reflect.apply(t.observe, t, [n, Object.freeze({
				attributeFilter: Object.freeze([
					"badge",
					"badgeStyle",
					"disabled",
					"label",
					"style",
					"tooltiptext"
				]),
				attributes: !0,
				subtree: !0
			})]);
			y = t;
		} catch {
			y = null;
		}
	}, fe = () => {
		let e = A(), t = Lr(e);
		if (!t) return v.clear(), de([]), Object.freeze({
			serialized: "unavailable",
			snapshot: Pn()
		});
		let n = p ?? ae(t), r = [], i = [], a = new Set();
		for (let e of ln) {
			let o = [];
			for (let r of n.zones[e]) {
				let e = P(t, r);
				o.push(e.widget), i.push(e.node), e.widget.handle !== "" && a.add(e.widget.handle);
			}
			r.push([e, Object.freeze(o)]);
		}
		for (let e of T) if (!a.has(e)) try {
			k.release(e);
		} catch {}
		T.clear();
		for (let e of a) T.add(e);
		de(i);
		let o = Rr(e), s = Object.freeze({
			available: !0,
			canEdit: o !== null,
			layoutCustomized: p !== null,
			palette: ue(t, n),
			style: jn(m),
			zones: Object.freeze(Object.fromEntries(r))
		});
		return Object.freeze({
			serialized: JSON.stringify(s),
			snapshot: s
		});
	}, pe = () => {
		if (a) return;
		let e = fe();
		if (e.serialized === d) return;
		d = e.serialized, f = e.snapshot, s += 1;
		let t = Object.freeze({
			revision: s,
			snapshot: f,
			type: "snapshot"
		});
		for (let e of Array.from(D)) e(t);
	}, F = () => {
		if (a || c) return;
		c = !0;
		let e = () => {
			c = !1, !a && pe();
		}, t = i, n = t?.setTimeout;
		if (t && Z(n)) {
			Reflect.apply(n, t, [e, 0]);
			return;
		}
		queueMicrotask(e);
	}, me = Object.freeze({
		onAreaReset: () => F(),
		onCustomizeEnd: () => F(),
		onWidgetAdded: () => F(),
		onWidgetCreated: () => F(),
		onWidgetDestroyed: () => F(),
		onWidgetInstanceRemoved: () => F(),
		onWidgetMoved: () => F(),
		onWidgetOverflow: () => F(),
		onWidgetRemoved: () => F(),
		onWidgetReset: () => F(),
		onWidgetUndoMove: () => F(),
		onWidgetUnderflow: () => F()
	}), he = () => {
		if (!l) return;
		l = !1;
		let e = i;
		if (!e) return;
		let t = Lr(e);
		if (t) try {
			Reflect.apply(t.removeListener, t, [me]);
		} catch {}
	}, ge = () => {
		let e = i;
		if (!e) return;
		let t = Rr(e);
		if (!t) {
			p = null, m = On();
			return;
		}
		p = Yn(zr(t, fr)), m = Zn(zr(t, pr)) ?? On();
	}, I = Object.freeze({ observe: () => {
		a || (ge(), F());
	} }), _e = () => {
		if (!u) return;
		u = !1;
		let e = i, t = e ? Rr(e) : null;
		if (t) try {
			Reflect.apply(t.removeObserver, t, [mr, I]);
		} catch {}
	}, ve = () => {
		let t = Rr(A());
		if (!t) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.Services.prefs");
		return t;
	}, ye = (e) => {
		let t = ve();
		Reflect.apply(t.setStringPref, t, [fr, Xn(e)]), p = e;
	}, L = (e) => {
		let t = ve();
		Reflect.apply(t.setStringPref, t, [pr, Qn(e)]), m = e;
	}, R = (t, n, r) => {
		let i = "";
		if (Z(t.getPlacementOfWidget)) try {
			let e = Reflect.apply(t.getPlacementOfWidget, t, [r]);
			X(e) && typeof e.area == "string" && (i = e.area);
		} catch {
			i = "";
		}
		if (i !== "" && i !== Br(t)) return n;
		if (!Z(t.addWidgetToArea)) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI.addWidgetToArea");
		return Reflect.apply(t.addWidgetToArea, t, [r, ur]), sr(n, r);
	}, be = (e, t, n) => {
		if (!t.adopted.includes(n)) return t;
		if (Vr(e, n)) {
			if (Z(e.addWidgetToArea)) try {
				Reflect.apply(e.addWidgetToArea, e, [n, Br(e)]);
			} catch {}
		} else if (Z(e.removeWidgetFromArea)) try {
			Reflect.apply(e.removeWidgetFromArea, e, [n]);
		} catch {}
		return cr(t, n);
	}, xe = () => {
		let t = Lr(A());
		if (!t) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI");
		return t;
	}, Se = async (t) => {
		A();
		let n;
		try {
			n = Ln(t);
		} catch (t) {
			throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
		}
		o += 1;
		try {
			if (n.type === "set-style") return L(jn({
				...m,
				...n.style
			})), pe(), !0;
			if (n.type === "reset-style") {
				let e = ve();
				try {
					Reflect.apply(e.clearUserPref, e, [pr]);
				} catch {}
				return m = On(), pe(), !0;
			}
			let t = xe();
			if (ve(), n.revision !== s) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_STALE", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit-revision");
			let r = p ?? ae(t);
			try {
				switch (n.type) {
					case "add": {
						let i = v.get(n.token);
						if (!i) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.palette-token");
						let a = r;
						i.type === "widget" && (a = R(t, a, i.id)), a = rr(a, i, n.zone, n.index), ye(a);
						break;
					}
					case "move":
						ye(or(r, n.fromZone, n.fromIndex, n.toZone, n.toIndex));
						break;
					case "remove": {
						let e = ar(r, n.zone, n.index), i = ir(r, n.zone, n.index);
						e.type === "widget" && !lr(i, e.id) && (i = be(t, i, e.id)), ye(i);
						break;
					}
					case "reset-layout": {
						let e = r;
						for (let n of [...r.adopted]) e = be(t, e, n);
						let n = ve();
						try {
							Reflect.apply(n.clearUserPref, n, [fr]);
						} catch {}
						p = null;
						break;
					}
				}
			} catch (t) {
				throw _(t) ? t : Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_FAILED", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
			}
			return pe(), !0;
		} finally {
			--o;
		}
	}, z = (e) => {
		let t = Object.freeze({
			open: e,
			type: "widget-popup"
		});
		for (let e of Array.from(O)) e(t);
	}, B = (e) => {
		let t = S;
		if (!t) return;
		S = null;
		let n = i;
		if (n && Z(n.clearTimeout)) try {
			Reflect.apply(n.clearTimeout, n, [t.timeoutHandle]);
		} catch {}
		t.resolve(e);
	}, Ce = (e) => {
		let t = w;
		if (!t) return;
		w = null;
		let n = i;
		if (t.timeoutHandle !== void 0 && n && Z(n.clearTimeout)) try {
			Reflect.apply(n.clearTimeout, n, [t.timeoutHandle]);
		} catch {}
		t.resolve(e);
	}, we = (e, t) => {
		b = e, x = t, z(!0);
	}, V = () => {
		b && (b = null, x = "", z(!1));
	}, Te = (e) => X(e) ? X(e.originalTarget) ? e.originalTarget : X(e.target) ? e.target : null : null, H = (e, t) => {
		if (t === e) return !0;
		if (!Z(e.contains)) return !1;
		try {
			return Reflect.apply(e.contains, e, [t]) === !0;
		} catch {
			return !1;
		}
	}, Ee = (e) => {
		if (a) return;
		let t = Te(e);
		if (!t || !Pr(t)) return;
		let n = typeof t.id == "string" ? t.id : "";
		if (S && n === _r) {
			let e = C;
			B(!0), C = "", we(t, e);
			return;
		}
		if (w) {
			let e = t.anchorNode;
			if (H(w.node, e)) {
				let { handle: e, host: n } = w;
				try {
					Reflect.apply(t.moveToAnchor, t, [
						n,
						yr,
						0,
						0
					]);
				} catch {}
				we(t, e), Ce(!0);
			}
		}
	}, De = (e) => {
		if (a) return;
		let t = Te(e);
		if (!t) return;
		if (b && t === b) {
			V();
			return;
		}
		let n = typeof t.id == "string" ? t.id : "";
		S && n === _r && (B(!1), C = "");
	}, Oe = (e) => {
		let t = A();
		return B(!1), new Promise((n) => {
			let r = {
				resolve: n,
				timeoutHandle: void 0
			};
			S = r, C = e;
			let i = () => {
				S === r && (S = null, C = "", n(!1));
			}, a = t.setTimeout;
			Z(a) ? r.timeoutHandle = Reflect.apply(a, t, [i, vr]) : queueMicrotask(i);
		});
	}, U = (e, t, n) => {
		let r = A();
		return Ce(!1), new Promise((i) => {
			let a = {
				handle: e,
				host: t,
				node: n,
				resolve: i,
				timeoutHandle: void 0
			};
			w = a;
			let o = () => {
				w === a && (w = null, i(!1));
			}, s = r.setTimeout;
			Z(s) ? a.timeoutHandle = Reflect.apply(s, r, [o, vr]) : queueMicrotask(o);
		});
	}, ke = () => {
		let e = b;
		if (e) try {
			Reflect.apply(e.hidePopup, e, []);
		} catch {
			V();
		}
	}, Ae = (t) => {
		if (Z(t.doCommand)) try {
			Reflect.apply(t.doCommand, t, []);
			return;
		} catch {}
		let n = A().CustomEvent;
		if (!Z(n) || !Z(t.dispatchEvent)) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command");
		let r = Reflect.construct(n, ["command", Object.freeze({
			bubbles: !0,
			cancelable: !0
		})]);
		Reflect.apply(t.dispatchEvent, t, [r]);
	}, je = (e) => {
		let t = Lr(A()), n = typeof e.id == "string" ? e.id : "";
		if (!t || !n) return "";
		try {
			let e = Reflect.apply(t.getWidget, t, [n]);
			if (X(e) && typeof e.viewId == "string") return e.viewId;
		} catch {
			return "";
		}
		return "";
	}, Me = Object.freeze({
		edit: Se,
		invoke: async (t, n) => {
			if (typeof t != "string" || t === "") throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.handle");
			let r = te(n), i = k.resolve(t);
			if (!Zr(i)) throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE", "firefox-toolbar-widgets-action", "toolbar-widgets.native-node");
			o += 1;
			try {
				if (b && x === t) return ke(), !0;
				ke();
				let n = A(), a = je(i), o = Hr(n);
				if (a && o) {
					try {
						r.open === !0 && (r.open = !1);
					} catch {}
					let i = Oe(t);
					try {
						let e = Reflect.apply(o, n.PanelUI, [a, r]);
						Promise.resolve(e).catch(() => {});
					} catch (t) {
						throw B(!1), C = "", Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.PanelUI.showSubView", t);
					}
					return await i;
				}
				let s = U(t, r, i);
				try {
					Ae(i);
				} catch (t) {
					throw Ce(!1), _(t) ? t : Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command", t);
				}
				return await s;
			} finally {
				--o;
			}
		},
		snapshot() {
			A();
			let e = fe();
			return d = e.serialized, f = e.snapshot, f;
		},
		subscribe(t) {
			if (A(), typeof t != "function") throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			D.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, D.delete(t), !0) : !1);
		},
		subscribePopup(t) {
			if (A(), typeof t != "function") throw Q(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			O.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, O.delete(t), !0) : !1);
		}
	});
	try {
		ee();
		let t = A().document;
		E.push(e.subscribe(t, "popupshown", Ee, wr), e.subscribe(t, "popuphidden", De, wr));
		let n = Lr(A());
		n && (Reflect.apply(n.addListener, n, [me]), l = !0);
		let r = Rr(A());
		r && (Reflect.apply(r.addObserver, r, [mr, I]), u = !0), ge();
		let i = fe();
		d = i.serialized, f = i.snapshot;
	} catch (e) {
		a = !0, _e(), i = null;
		for (let e of E.reverse()) try {
			e();
		} catch {}
		throw E.length = 0, e;
	}
	return Object.freeze({
		assertRequiredCapabilities: ee,
		dispose() {
			if (a) return !1;
			let e = b;
			if (a = !0, B(!1), C = "", Ce(!1), he(), _e(), X(y) && Z(y.disconnect)) try {
				Reflect.apply(y.disconnect, y, []);
			} catch {}
			if (y = null, b = null, x = "", e) try {
				Reflect.apply(e.hidePopup, e, []);
			} catch {}
			D.clear(), O.clear(), T.clear(), g.clear(), v.clear(), k.dispose(), i = null;
			for (let e of E.reverse()) try {
				e();
			} catch {}
			return E.length = 0, !0;
		},
		refresh() {
			return !a && (pe(), !0);
		},
		snapshot() {
			return Object.freeze({
				disposed: a,
				pendingActionCount: o,
				revision: s,
				widgetCount: ln.reduce((e, t) => e + f.zones[t].length, 0)
			});
		},
		toolbarWidgets: Me
	});
}
//#endregion
//#region src/app/urlbar-coverage-state.ts
var ii = Object.freeze([
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
]), ai = Object.freeze([
	"location",
	"media",
	"serial",
	"xr"
]), oi = Object.freeze([
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
new Set(ii), new Set(ai), new Set(oi);
//#endregion
//#region src/firefox/urlbar-coverage.ts
var si = Object.freeze([
	"blocked-permissions-container",
	"identity-permission-box",
	"page-action-buttons"
]), ci = Object.freeze({
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
}), li = Object.freeze([
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
]), ui = Object.freeze([
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
]), di = new Set([
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
]), fi = (e) => typeof e == "object" && !!e, pi = (e) => typeof e == "function", mi = (e) => fi(e) && pi(e.getAttribute) && pi(e.hasAttribute), hi = (e) => fi(e) && pi(e.getElementById), gi = (e) => hi(e.document) ? e.document : null, _i = (e, t) => {
	let n = gi(e);
	return n ? Reflect.apply(n.getElementById, n, [t]) : void 0;
}, vi = (e) => gi(e)?.documentElement, yi = Object.freeze([
	Object.freeze({
		isAvailable: pi,
		name: "firefox.urlbar-coverage-native-access",
		read: (e) => e.openLocation,
		symbol: "window.openLocation"
	}),
	Object.freeze({
		isAvailable: pi,
		name: "firefox.urlbar-coverage-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: mi,
		name: "firefox.urlbar-coverage-urlbar-state",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.hasAttribute"
	}),
	Object.freeze({
		isAvailable: mi,
		name: "firefox.urlbar-coverage-window-state",
		read: vi,
		symbol: "document.documentElement.hasAttribute"
	}),
	...si.map((e) => Object.freeze({
		isAvailable: mi,
		name: `firefox.urlbar-coverage-${e}`,
		read: (t) => _i(t, e),
		symbol: `document.elements[${e}]`
	}))
]), bi = (e, t) => Object.freeze([...yi.map((t) => {
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
	available: pi(t),
	name: "firefox.urlbar-coverage-native-ui-handoff",
	requirement: "required",
	symbol: "nativeUi.revealForUrlbar"
}) })]), xi = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, $ = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: xi(e),
	phase: n,
	symbol: r
}), Si = (e, t) => {
	let n = Reflect.apply(e.getAttribute, e, [t]);
	return typeof n == "string" ? n : null;
}, Ci = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), wi = (e) => {
	if (e.hidden === !0) return !1;
	let t = Si(e, "hidden");
	return t !== null && t !== "false" ? !1 : Si(e, "collapsed") !== "true";
}, Ti = (e) => {
	let t = e.children;
	return Object.freeze(!t || typeof t != "object" && !Array.isArray(t) ? [] : Array.from(t));
}, Ei = (e, t) => {
	let n = e.classList;
	return fi(n) && pi(n.contains) && !!Reflect.apply(n.contains, n, [t]);
}, Di = (e, t) => e.permissions.available === t.permissions.available && e.permissions.hasPermissions === t.permissions.hasPermissions && e.permissions.blocked.length === t.permissions.blocked.length && e.permissions.blocked.every((e, n) => e === t.permissions.blocked[n]) && e.permissions.sharing.length === t.permissions.sharing.length && e.permissions.sharing.every((e, n) => e === t.permissions.sharing[n]) && e.items.length === t.items.length && e.items.every((e, n) => e === t.items[n]);
function Oi({ boundary: e, onError: t, requestNativeUiReveal: n, window: r }) {
	if (e.assertOwnsWindow(r), !fi(r) || typeof t != "function" || typeof n != "function") throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_OPTIONS_INVALID", "firefox-urlbar-coverage-create", "window");
	let i = r, a = !1, o = null, s = 0, c = null, l = Object.freeze({
		items: Object.freeze([]),
		permissions: Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		})
	}), u = new Set(), d = () => {
		if (a || !i) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSED", "firefox-urlbar-coverage-access", "window.gURLBar");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, f = (t) => {
		let n = _i(d(), t);
		if (!mi(n)) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", `document.elements[${t}]`);
		return n;
	}, p = () => {
		let t = d().gURLBar;
		if (!mi(t)) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "window.gURLBar.hasAttribute");
		return t;
	}, m = () => {
		let t = vi(d());
		if (!mi(t)) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "document.documentElement.hasAttribute");
		return t;
	}, h = () => {
		let t = bi(d(), n), r = t.find((e) => !e.snapshot.available);
		if (r) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-capability", r.snapshot.symbol, r.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, g = () => {
		let e = p(), t = f("identity-permission-box"), n = Object.freeze(li.flatMap(({ id: e, kind: t }) => {
			let n = _i(d(), e);
			return mi(n) && Ci(n, "sharing") ? [t] : [];
		}));
		if (!(Si(e, "pageproxystate") === "valid" || Ci(e, "persistsearchterms") || n.length > 0)) return Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		});
		let r = Object.freeze(Ti(f("blocked-permissions-container")).flatMap((e) => {
			if (!mi(e) || !Ci(e, "showing")) return [];
			let t = Si(e, "data-permission-id"), n = t ? ci[t] : void 0;
			return n ? [n] : [];
		}));
		return Object.freeze({
			available: !0,
			blocked: r,
			hasPermissions: Ci(t, "hasPermissions"),
			sharing: n
		});
	}, v = () => {
		let e = d(), t = p(), n = new Set();
		Ci(m(), "remotecontrol") && n.add("remote-control"), Ci(t, "searchmode") && n.add("search-mode"), Ci(t, "persistsearchterms") && n.add("persisted-search");
		for (let { id: t, kind: r } of ui) {
			let i = _i(e, t);
			mi(i) && wi(i) && n.add(r);
		}
		let r = _i(e, "pageActionButton");
		mi(r) && Ci(r, "multiple-children") && n.add("more-page-actions");
		for (let e of Ti(f("page-action-buttons"))) {
			if (!mi(e) || !wi(e) || !Ei(e, "urlbar-page-action")) continue;
			let t = typeof e.id == "string" ? e.id : "";
			di.has(t) || (Ei(e, "urlbar-addon-page-action") ? n.add("extension-actions") : Ci(e, "actionid") && n.add("other-page-actions"));
		}
		return Object.freeze(oi.filter((e) => n.has(e)));
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
			t($(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED", "firefox-urlbar-coverage-notify", "urlbarCoverage.subscribe", n));
		}
	}, S = (e) => {
		let t = y();
		return Di(l, t) && s > 0 ? !1 : (l = t, s += 1, e && x(), !0);
	}, C = (n) => {
		o = _(n) ? n : $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_EVENT_FAILED", "firefox-urlbar-coverage-event", "window.MutationObserver", n), t(o);
	}, w = Object.freeze({
		openNativeUrlbar() {
			let t = d(), r = t.openLocation;
			if (!pi(r)) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-native-access", "window.openLocation");
			try {
				if (n() !== !0) throw $(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_UI_HANDOFF_REJECTED", "firefox-urlbar-native-access", "nativeUi.revealForUrlbar");
				return Reflect.apply(r, t, []), !0;
			} catch (t) {
				throw _(t) ? t : $(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_ACCESS_FAILED", "firefox-urlbar-native-access", "window.openLocation", t);
			}
		},
		snapshot() {
			return d(), l;
		},
		subscribe(t) {
			if (d(), typeof t != "function") throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_LISTENER_INVALID", "firefox-urlbar-coverage-subscribe", "urlbarCoverage.subscribe");
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
			t($(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", n));
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
			if (c = null, u.clear(), i = null, t !== void 0) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", t);
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
//#region src/app/window-controls-state.ts
var ki = Object.freeze([
	"close",
	"minimize",
	"toggle-maximize"
]), Ai = new Set(ki);
function ji(e) {
	return typeof e == "string" && Ai.has(e);
}
//#endregion
//#region src/firefox/window-controls.ts
var Mi = (e) => typeof e == "object" && !!e, Ni = (e) => typeof e == "function", Pi = (e, t) => {
	let n = e.document;
	if (!(!Mi(n) || !Ni(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Fi = (e) => Object.freeze(e), Ii = Object.freeze([
	Fi({
		isAvailable: Ni,
		name: "window-controls.minimize",
		read: (e) => e.minimize,
		symbol: "window.minimize"
	}),
	Fi({
		isAvailable: Ni,
		name: "window-controls.maximize",
		read: (e) => e.maximize,
		symbol: "window.maximize"
	}),
	Fi({
		isAvailable: Ni,
		name: "window-controls.restore",
		read: (e) => e.restore,
		symbol: "window.restore"
	}),
	Fi({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.window-state",
		read: (e) => e.windowState,
		symbol: "window.windowState"
	}),
	Fi({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.state-maximized",
		read: (e) => e.STATE_MAXIMIZED,
		symbol: "window.STATE_MAXIMIZED"
	}),
	Fi({
		isAvailable: Ni,
		name: "window-controls.sizemode-events",
		read: (e) => e.addEventListener,
		symbol: "window.addEventListener"
	}),
	Fi({
		isAvailable: (e) => Mi(e) && Ni(e.doCommand),
		name: "window-controls.close-command",
		read: (e) => Pi(e, "cmd_closeWindow"),
		symbol: "document.cmd_closeWindow.doCommand"
	})
]), Li = (e) => Object.freeze(Ii.map((t) => {
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
})), Ri = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, zi = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Ri(e),
	phase: n,
	symbol: r
}), Bi = (e) => {
	let t = e.windowState === e.STATE_MAXIMIZED || typeof e.STATE_FULLSCREEN == "number" && e.windowState === e.STATE_FULLSCREEN;
	return Object.freeze({ maximized: t });
};
function Vi({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !Mi(n) || typeof t != "function") throw zi(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_OPTIONS_INVALID", "firefox-window-controls-create", "window");
	let r = n, i = !1, a = new Set(), o, s = () => {
		if (i || !r) throw zi(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_DISPOSED", "firefox-window-controls-access", "window");
		return r;
	}, c = () => {
		let t = Li(s()), n = t.find((e) => !e.snapshot.available);
		if (n) throw zi(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, l = () => {
		let n;
		try {
			n = Bi(s());
		} catch (e) {
			t(e);
			return;
		}
		for (let r of Array.from(a)) try {
			r(n);
		} catch (n) {
			t(zi(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBER_FAILED", "firefox-window-controls-notify", "windowControls.subscribe", n));
		}
	}, u = (t) => {
		if (!ji(t)) throw zi(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_INVALID", "firefox-window-controls-action", "windowControls.action");
		c();
		let n = s();
		try {
			if (t === "minimize") return Reflect.apply(n.minimize, n, []), !0;
			if (t === "toggle-maximize") return Bi(n).maximized ? Reflect.apply(n.restore, n, []) : Reflect.apply(n.maximize, n, []), !0;
			let r = Pi(n, "cmd_closeWindow");
			if (!Mi(r) || !Ni(r.doCommand)) throw zi(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-action", "document.cmd_closeWindow.doCommand");
			return Reflect.apply(r.doCommand, r, []), !0;
		} catch (n) {
			throw n instanceof g ? n : zi(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_FAILED", "firefox-window-controls-action", t === "close" ? "document.cmd_closeWindow.doCommand" : `window.${t}`, n);
		}
	};
	try {
		o = x({
			listener() {
				l();
			},
			target: n,
			type: "sizemodechange"
		});
	} catch (t) {
		throw zi(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBE_FAILED", "firefox-window-controls-subscribe", "window.addEventListener", t);
	}
	let d = Object.freeze({
		invoke: u,
		snapshot() {
			return Bi(s());
		},
		subscribe(t) {
			if (typeof t != "function") throw zi(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_LISTENER_INVALID", "firefox-window-controls-subscribe", "windowControls.subscribe");
			return s(), a.add(t), () => a.delete(t);
		}
	});
	return Object.freeze({
		assertRequiredCapabilities: c,
		dispose() {
			return !i && (i = !0, r = null, a.clear(), o?.(), o = void 0, !0);
		},
		snapshot() {
			return Object.freeze({ disposed: i });
		},
		windowControls: d
	});
}
//#endregion
export { g as FirefoxBridgeError, ce as createFirefoxBookmarksBridge, T as createFirefoxBridgeBoundary, Me as createFirefoxBrowserToolsBridge, Ge as createFirefoxDownloadsBridge, Mt as createFirefoxNavigationBridge, sn as createFirefoxTabsBridge, ri as createFirefoxToolbarWidgetsBridge, Oi as createFirefoxUrlbarCoverageBridge, Vi as createFirefoxWindowControlsBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, _ as isFirefoxBridgeError, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic };
