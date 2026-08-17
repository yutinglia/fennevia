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
]), k = 16, A = 128, j = 1e6, M = /^[A-Za-z0-9_-]{12}$/u, N = new Set([
	"data:",
	"javascript:",
	"place:",
	"vbscript:"
]), P = (e) => typeof e == "object" && !!e, F = (e) => typeof e == "function", ee = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, I = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: ee(e),
	phase: n,
	symbol: r
}), L = (e, t, n, r) => {
	if (typeof t != "string" || !M.test(t)) throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_GUID_INVALID", n, r);
	return t;
}, R = (e) => {
	let t = "", n = 0;
	for (let r of e) {
		if (n >= 160) break;
		t += r, n += 1;
	}
	return t;
}, te = (e, t, n, r, i) => {
	if (!P(t) || typeof t.guid != "string" || typeof t.parentGuid != "string" || typeof t.index != "number" || !Number.isSafeInteger(t.index) || t.index < 0 || typeof t.type != "number" || typeof t.title != "string" || (L(e, t.guid, r, "PlacesUtils.bookmarks.fetch.result.guid"), L(e, t.parentGuid, r, "PlacesUtils.bookmarks.fetch.result.parentGuid"), i !== void 0 && t.guid !== i || ![
		n.TYPE_BOOKMARK,
		n.TYPE_FOLDER,
		n.TYPE_SEPARATOR
	].includes(t.type) || t.type === n.TYPE_FOLDER && (!Number.isSafeInteger(t.childCount) || t.childCount < 0))) throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID", r, "PlacesUtils.bookmarks.fetch.result");
	return t;
}, ne = (e, t, n) => {
	if (t.type === n.TYPE_BOOKMARK) return "bookmark";
	if (t.type === n.TYPE_FOLDER) return "folder";
	if (t.type === n.TYPE_SEPARATOR) return "separator";
	throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_TYPE_INVALID", "firefox-bookmarks-snapshot", "PlacesUtils.bookmarks.TYPE_BOOKMARK");
}, re = (e) => {
	if (!P(e) || typeof e.href != "string") return null;
	if (typeof e.protocol == "string") return e.protocol.toLowerCase();
	let t = e.href.indexOf(":");
	return t > 0 ? `${e.href.slice(0, t).toLowerCase()}:` : null;
};
function ie({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !P(r) || typeof t != "function" || typeof n != "function") throw I(e, "FENNEVIA_FIREFOX_BOOKMARKS_OPTIONS_INVALID", "firefox-bookmarks-create", "ChromeUtils.importESModule");
	let i, a;
	try {
		i = t(E), a = t(D);
	} catch (t) {
		throw I(e, "FENNEVIA_FIREFOX_BOOKMARKS_MODULE_LOAD_FAILED", "firefox-bookmarks-module-load", "ChromeUtils.importESModule", t);
	}
	let o = P(i) ? i.PlacesUtils : void 0, s = P(a) ? a.PlacesUIUtils : void 0, c = o, l = s, u = Object.freeze([
		Object.freeze({
			isAvailable: P,
			name: "firefox.places-utils",
			read: () => o,
			symbol: "PlacesUtils"
		}),
		Object.freeze({
			isAvailable: P,
			name: "firefox.places-bookmarks",
			read: () => c?.bookmarks,
			symbol: "PlacesUtils.bookmarks"
		}),
		Object.freeze({
			isAvailable: F,
			name: "firefox.places-bookmarks-fetch",
			read: () => c?.bookmarks?.fetch,
			symbol: "PlacesUtils.bookmarks.fetch"
		}),
		Object.freeze({
			isAvailable: (e) => Array.isArray(e) && e.length === 4 && e.every((e) => typeof e == "string" && M.test(e)),
			name: "firefox.places-bookmark-roots",
			read: () => c?.bookmarks?.userContentRoots,
			symbol: "PlacesUtils.bookmarks.userContentRoots"
		}),
		Object.freeze({
			isAvailable: F,
			name: "firefox.places-root-title",
			read: () => c?.bookmarks?.getLocalizedTitle,
			symbol: "PlacesUtils.bookmarks.getLocalizedTitle"
		}),
		Object.freeze({
			isAvailable: P,
			name: "firefox.places-observers",
			read: () => c?.observers,
			symbol: "PlacesUtils.observers"
		}),
		...["addListener", "removeListener"].map((e) => Object.freeze({
			isAvailable: F,
			name: `firefox.places-observers-${e.toLowerCase()}`,
			read: () => c?.observers?.[e],
			symbol: `PlacesUtils.observers.${e}`
		})),
		Object.freeze({
			isAvailable: P,
			name: "firefox.places-ui-utils",
			read: () => s,
			symbol: "PlacesUIUtils"
		}),
		Object.freeze({
			isAvailable: F,
			name: "firefox.places-node-conversion",
			read: () => l?.promiseNodeLikeFromFetchInfo,
			symbol: "PlacesUIUtils.promiseNodeLikeFromFetchInfo"
		}),
		Object.freeze({
			isAvailable: F,
			name: "firefox.places-open-node",
			read: () => l?.openNodeIn,
			symbol: "PlacesUIUtils.openNodeIn"
		})
	]), d = r, f = !1, p = null, m = !1, h = 0, g = new Set(), v = e.createHandleRegistry("bookmark"), y = new Map(), x = new Map(), S = () => {
		if (f || !d) throw I(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSED", "firefox-bookmarks-access", "window");
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
		if (n) throw I(e, "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING", "firefox-bookmarks-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (t) => {
		S();
		let n = L(e, t, "firefox-bookmarks-handle", "PlacesUtils.bookmarks.guid"), r = x.get(n);
		if (r) return r;
		let i = Object.freeze({ guid: n }), a = v.register(i);
		return y.set(n, i), x.set(n, a), a;
	}, ee = (e) => {
		if (typeof e != "string" || !M.test(e)) return !1;
		let t = x.get(e);
		if (!t) return !1;
		x.delete(e), y.delete(e);
		try {
			return v.release(t);
		} catch {
			return !1;
		}
	}, ie = (e) => (S(), v.resolve(e).guid), ae = (t, n = t.title) => {
		let r = ne(e, t, c.bookmarks);
		return Object.freeze({
			hasChildren: r === "folder" && Number.isSafeInteger(t.childCount) && t.childCount > 0,
			id: T(t.guid),
			kind: r,
			title: R(n)
		});
	}, oe = async (t, n) => {
		S();
		let r;
		try {
			r = await Reflect.apply(c.bookmarks.fetch, c.bookmarks, [t]);
		} catch (t) {
			throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_FAILED", n, "PlacesUtils.bookmarks.fetch", t);
		}
		return S(), r === null ? null : te(e, r, c.bookmarks, n, "guid" in t ? t.guid : void 0);
	}, se = (t, r) => {
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
			n(I(e, "FENNEVIA_FIREFOX_BOOKMARKS_SUBSCRIBER_FAILED", "firefox-bookmarks-notify", "bookmarks.subscribe", t));
		}
	}, ce = (t) => {
		p = _(t) ? t : I(e, "FENNEVIA_FIREFOX_BOOKMARKS_OBSERVER_FAILED", "firefox-bookmarks-observer", "PlacesUtils.observers.addListener", t), n(p);
	}, le = (t) => {
		if (!(f || p)) try {
			if (!Array.isArray(t)) throw I(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEventCallback.events");
			if (t.length > A) {
				se(Object.freeze([]), "all");
				return;
			}
			let n = new Set(), r = [];
			for (let i of t) {
				if (!P(i) || typeof i.type != "string" || !O.includes(i.type) || typeof i.parentGuid != "string" || typeof i.isTagging != "boolean") throw I(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEvent");
				if (i.isTagging) continue;
				L(e, i.parentGuid, "firefox-bookmarks-observer", "PlacesEvent.parentGuid");
				let t = x.get(i.parentGuid);
				if (t && n.add(t), i.type === "bookmark-moved") {
					let t = L(e, i.oldParentGuid, "firefox-bookmarks-observer", "PlacesBookmarkMoved.oldParentGuid"), r = x.get(t);
					r && n.add(r);
				}
				i.type === "bookmark-removed" && r.push(L(e, i.guid, "firefox-bookmarks-observer", "PlacesBookmarkRemoved.guid"));
			}
			let i = Array.from(n);
			i.length > k ? se(Object.freeze([]), "all") : i.length > 0 && se(Object.freeze(i), "parents");
			for (let e of r) ee(e);
		} catch (e) {
			ce(e);
		}
	}, ue = b(() => {
		m && (m = !1, Reflect.apply(c.observers.removeListener, c.observers, [O, le]));
	}), de = Object.freeze({
		async children(t, n = {}) {
			let r;
			try {
				r = ie(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					parentId: t,
					status: "stale"
				});
				throw e;
			}
			if (!P(n) || Object.keys(n).some((e) => e !== "limit" && e !== "offset")) throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let i = n.limit ?? 32, a = n.offset ?? 0;
			if (!Number.isSafeInteger(i) || i < 1 || i > 32 || !Number.isSafeInteger(a) || a < 0 || a > j) throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let o = await oe({ guid: r }, "firefox-bookmarks-query-parent");
			if (!o) return ee(r), Object.freeze({
				parentId: t,
				status: "stale"
			});
			if (o.type !== c.bookmarks.TYPE_FOLDER) return Object.freeze({
				parentId: t,
				status: "stale"
			});
			let s = o.childCount, l = s === 0 ? 0 : Math.min(a, Math.floor((s - 1) / i) * i), u = Math.min(s, l + i), d = [];
			for (let e = l; e < u; e += 1) {
				let n = await oe({
					index: e,
					parentGuid: r
				}, "firefox-bookmarks-query-child");
				if (!n || n.parentGuid !== r || n.index !== e) return Object.freeze({
					parentId: t,
					status: "stale"
				});
				d.push(ae(n));
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
			if (n !== "current" && n !== "new-tab") throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_DISPOSITION_INVALID", "firefox-bookmarks-open", "bookmarks.open.disposition");
			let r;
			try {
				r = ie(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					reason: "stale",
					status: "rejected"
				});
				throw e;
			}
			let i = await oe({ guid: r }, "firefox-bookmarks-open-fetch");
			if (!i) return ee(r), Object.freeze({
				reason: "stale",
				status: "rejected"
			});
			if (i.type !== c.bookmarks.TYPE_BOOKMARK) return Object.freeze({
				reason: "not-bookmark",
				status: "rejected"
			});
			let a = re(i.url);
			if (!a || N.has(a)) return Object.freeze({
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
				throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_OPEN_FAILED", "firefox-bookmarks-open", "PlacesUIUtils.openNodeIn", t);
			}
			return Object.freeze({ status: "opened" });
		},
		async roots() {
			S();
			let t = c.bookmarks.userContentRoots, n = [];
			for (let r of t) {
				let t = await oe({ guid: r }, "firefox-bookmarks-query-roots");
				if (!t || t.type !== c.bookmarks.TYPE_FOLDER) throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.userContentRoots");
				let i;
				try {
					i = Reflect.apply(c.bookmarks.getLocalizedTitle, c.bookmarks, [t]);
				} catch (t) {
					throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_FAILED", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle", t);
				}
				if (typeof i != "string") throw I(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle");
				n.push(ae(t, i));
			}
			return Object.freeze(n);
		},
		subscribe(t) {
			if (S(), typeof t != "function") throw I(e, "FENNEVIA_FIREFOX_BOOKMARKS_LISTENER_INVALID", "firefox-bookmarks-subscribe", "bookmarks.subscribe");
			return g.add(t), b(() => {
				g.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), Reflect.apply(c.observers.addListener, c.observers, [O, le]), m = !0;
	} catch (t) {
		f = !0, d = null;
		let r;
		try {
			ue();
		} catch (e) {
			r = e;
		}
		try {
			v.dispose();
		} catch (e) {
			r ??= e;
		}
		throw r !== void 0 && n(I(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", r)), t;
	}
	return Object.freeze({
		assertRequiredCapabilities: w,
		bookmarks: de,
		dispose() {
			if (f) return !1;
			f = !0, d = null;
			let t;
			try {
				ue();
			} catch (e) {
				t = e;
			}
			g.clear(), y.clear(), x.clear();
			try {
				v.dispose();
			} catch (e) {
				t ??= e;
			}
			if (t !== void 0) throw I(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", t);
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
var ae = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"application-menu",
	"settings",
	"customize",
	"native-toolbar"
]), oe = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"application-menu"
]), se = new Set(ae), ce = new Set(oe);
function le(e) {
	return typeof e == "string" && se.has(e);
}
function ue(e) {
	return typeof e == "string" && ce.has(e);
}
//#endregion
//#region src/firefox/browser-tools.ts
var de = Object.freeze({ capture: !0 }), fe = Object.freeze([
	"appMenu-popup",
	"downloadsPanel",
	"identity-popup",
	"permission-popup",
	"protections-popup",
	"trustpanel-popup",
	"unified-extensions-panel"
]), pe = new Set(fe), z = Object.freeze({
	"application-menu": Object.freeze(["appMenu-popup"]),
	downloads: Object.freeze(["downloadsPanel"]),
	extensions: Object.freeze(["unified-extensions-panel"]),
	protections: Object.freeze(["trustpanel-popup", "protections-popup"]),
	"site-information": Object.freeze(["trustpanel-popup", "identity-popup"]),
	"site-permissions": Object.freeze(["permission-popup"])
}), me = "bottomcenter topright", he = Object.freeze({
	"application-menu": me,
	downloads: "after_start",
	extensions: "after_end",
	protections: "end_before",
	"site-information": "end_before",
	"site-permissions": "after_end"
}), ge = (e) => e === me, B = (e) => typeof e == "object" && !!e, V = (e) => typeof e == "function", _e = (e) => {
	let t = e.PanelMultiView;
	if (typeof t == "function") {
		let e = t;
		return V(e.openPopup) ? e : null;
	}
	return B(t) && V(t.openPopup) ? t : null;
}, ve = (e) => B(e) && V(e.addEventListener) && V(e.removeEventListener), ye = (e) => B(e) && V(e.click) && V(e.focus), H = (e) => B(e) && V(e.hidePopup) && V(e.moveToAnchor) && V(e.openPopup), be = (e) => typeof e == "number" && Number.isFinite(e) ? e : void 0, xe = (e) => {
	try {
		let t = Reflect.apply(e.getBoundingClientRect, e, []);
		if (!B(t)) return null;
		let n = be(t.left) ?? be(t.x), r = be(t.top) ?? be(t.y), i = be(t.width), a = be(t.height);
		return n === void 0 || r === void 0 || i === void 0 || a === void 0 ? null : Object.freeze({
			height: Math.max(1, Math.round(a)),
			width: Math.max(1, Math.round(i)),
			x: Math.round(n),
			y: Math.round(r)
		});
	} catch {
		return null;
	}
}, Se = (e) => {
	let t = be(e.mozInnerScreenX) ?? 0, n = be(e.mozInnerScreenY) ?? 0;
	return Object.freeze({
		x: Math.round(t),
		y: Math.round(n)
	});
}, U = (e, t) => {
	let n = e.document;
	if (!(!B(n) || !V(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Ce = (e) => B(e) ? e.panel : void 0, W = (e) => Object.freeze(e), we = Object.freeze([
	W({
		isAvailable: (e) => ye(e) && V(e.checkVisibility),
		name: "browser-tools.trust-anchor",
		read: (e) => U(e, "trust-icon-container"),
		symbol: "document.trust-icon-container.click.focus.checkVisibility"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.identity-anchor",
		read: (e) => U(e, "identity-icon-box"),
		symbol: "document.identity-icon-box.click.focus"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.protections-anchor",
		read: (e) => U(e, "tracking-protection-icon-container"),
		symbol: "document.tracking-protection-icon-container.click.focus"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.permissions-anchor",
		read: (e) => U(e, "identity-permission-box"),
		symbol: "document.identity-permission-box.click.focus"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.downloads-anchor",
		read: (e) => U(e, "downloads-button"),
		symbol: "document.downloads-button.click.focus"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.unified-extensions",
		read: (e) => B(e.gUnifiedExtensions) ? e.gUnifiedExtensions.togglePanel : void 0,
		symbol: "window.gUnifiedExtensions.togglePanel"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.application-menu",
		read: (e) => B(e.PanelUI) ? e.PanelUI.show : void 0,
		symbol: "window.PanelUI.show"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.application-menu-ready",
		read: (e) => B(e.PanelUI) ? e.PanelUI.ensureReady : void 0,
		symbol: "window.PanelUI.ensureReady"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.settings",
		read: (e) => e.openPreferences,
		symbol: "window.openPreferences"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.customize",
		read: (e) => B(e.gCustomizeMode) ? e.gCustomizeMode.enter : void 0,
		symbol: "window.gCustomizeMode.enter"
	}),
	W({
		isAvailable: (e) => B(e) && V(e.focus),
		name: "browser-tools.native-toolbar-focus",
		read: (e) => U(e, "back-button"),
		symbol: "document.back-button.focus"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.extensions-anchor",
		read: (e) => U(e, "unified-extensions-button"),
		symbol: "document.unified-extensions-button.click.focus"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.application-menu-anchor",
		read: (e) => U(e, "PanelUI-menu-button"),
		symbol: "document.PanelUI-menu-button.click.focus"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.trust-panel",
		read: (e) => B(e.gTrustPanelHandler) ? e.gTrustPanelHandler.showPopup : void 0,
		symbol: "window.gTrustPanelHandler.showPopup"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.permission-set-anchor",
		read: (e) => B(e.gPermissionPanel) ? e.gPermissionPanel.setAnchor : void 0,
		symbol: "window.gPermissionPanel.setAnchor"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.permission-open-popup",
		read: (e) => B(e.gPermissionPanel) ? e.gPermissionPanel.openPopup : void 0,
		symbol: "window.gPermissionPanel.openPopup"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.downloads-initialize",
		read: (e) => B(e.DownloadsPanel) ? e.DownloadsPanel.initialize : void 0,
		symbol: "window.DownloadsPanel.initialize"
	}),
	W({
		isAvailable: H,
		name: "browser-tools.downloads-panel",
		read: (e) => {
			let t = U(e, "downloadsPanel");
			return H(t) ? t : Ce(e.DownloadsPanel);
		},
		symbol: "document.downloadsPanel.openPopup.moveToAnchor.hidePopup"
	}),
	W({
		isAvailable: H,
		name: "browser-tools.application-menu-panel",
		read: (e) => {
			let t = U(e, "appMenu-popup");
			return H(t) ? t : Ce(e.PanelUI);
		},
		symbol: "document.appMenu-popup.openPopup.moveToAnchor.hidePopup"
	}),
	W({
		isAvailable: H,
		name: "browser-tools.extensions-panel",
		read: (e) => {
			let t = U(e, "unified-extensions-panel");
			return H(t) ? t : Ce(e.gUnifiedExtensions);
		},
		symbol: "document.unified-extensions-panel.openPopup.moveToAnchor.hidePopup"
	}),
	W({
		isAvailable: ve,
		name: "browser-tools.document-events",
		read: (e) => e.document,
		symbol: "document.addEventListener.removeEventListener"
	})
]), Te = (e) => Object.freeze(we.map((t) => {
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
})), Ee = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, G = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Ee(e),
	phase: n,
	symbol: r
}), De = (e) => {
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
}, K = (e) => {
	let t = e.state;
	if (t === "open" || t === "showing") return !0;
	let n = e.getAttribute;
	if (!V(n)) return !1;
	let r = Reflect.apply(n, e, ["state"]);
	return r === "open" || r === "showing";
}, Oe = (e) => B(e) ? B(e.originalTarget) ? e.originalTarget : B(e.target) ? e.target : null : null;
function ke({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, frame: r, requestNativeUiReveal: i, window: a }) {
	if (t.assertOwnsWindow(a), !B(a) || !B(r) || typeof r.contains != "function" || typeof i != "function" || typeof e != "function" || typeof n != "function") throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID", "firefox-browser-tools-create", "window");
	let o = (e) => Reflect.apply(r.contains, r, [e]) === !0, s = a, c = !1, l = 0, u = null, d = new Set(), f = [], p = new Set(), m = new Set(), h = () => {
		if (c || !s) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED", "firefox-browser-tools-access", "window");
		return s;
	}, g = () => {
		let e = Te(h()), n = e.find((e) => !e.snapshot.available);
		if (n) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(e.map((e) => e.snapshot));
	}, v = () => {
		let e;
		try {
			e = i() === !0;
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_FAILED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar", e);
		}
		if (!e) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar");
	}, y = async (e, n, r, i = []) => {
		let a = e[n];
		if (!V(a)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", r);
		try {
			await Reflect.apply(a, e, i);
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", r, e);
		}
	}, b = (e) => {
		let n = h();
		if (!B(e) || !V(e.getBoundingClientRect) || e.ownerDocument !== n.document || o(e) !== !0) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID", "firefox-browser-tools-action", "browser-tools.host");
		return e;
	}, x = (e) => {
		let t = h();
		for (let n of e) {
			let e = U(t, n);
			if (H(e) && K(e)) return e;
		}
		return null;
	}, S = (n) => {
		let r;
		try {
			r = e(n) === !0;
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_FAILED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff", e);
		}
		if (!r) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_REJECTED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff");
	}, C = (e) => {
		try {
			n(e);
		} catch {}
	}, w = (e, n) => {
		try {
			Reflect.apply(e.hidePopup, e, []);
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", n, e);
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
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
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
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
		}
	}, D = (e, t, n, r) => {
		if (ge(n)) {
			let n = xe(t), r = Se(h()), i = e.moveTo;
			if (n && V(i)) try {
				let t = r.x + n.x, a = r.y + n.y + n.height, o = e.getOuterScreenRect;
				if (V(o)) {
					let i = Reflect.apply(o, e, []);
					if (B(i)) {
						let e = be(i.width);
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
		for (let n of fe) {
			if (e.has(n)) continue;
			let r = U(t, n);
			H(r) && K(r) && w(r, `document.${n}.hidePopup`);
		}
	}, k = (e, t) => {
		let n = e.closest;
		if (V(n)) try {
			if (Reflect.apply(n, e, ["[data-fennevia-address-popup]"]) != null) return "after_end";
			if (Reflect.apply(n, e, ["[data-fennevia-edge=\"left\"]"]) != null) return "end_before";
		} catch {}
		return he[t];
	}, A = (e) => {
		let t = h();
		for (let n of z[e]) {
			let e = U(t, n);
			if (H(e)) return e;
		}
		return x(z[e]);
	}, j = (e) => {
		let n = A(e);
		if (!n) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", `document.${z[e][0]}.openPopup.moveToAnchor.hidePopup`);
		return n;
	}, M = async (e, n, r, i) => {
		let a = h(), o = _e(a), s = xe(n), c = Se(a), l, u = () => K(e), d = async (e) => {
			try {
				await e();
			} catch (e) {
				return l = e, u();
			}
			return u();
		}, f = () => {
			if (ge(r)) try {
				D(e, n, r, `${i}.moveTo`);
			} catch {}
		}, p = o && V(o.openPopup) ? o.openPopup : void 0, m = async (t, n) => !o || !p ? !1 : d(() => Reflect.apply(p, o, [
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
			return !s || !V(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
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
			return !s || !V(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
				c.x + s.x,
				c.y + s.y + s.height,
				!1
			]));
		}, C = (() => {
			let t = e.querySelector;
			if (!V(t)) return !1;
			try {
				return Reflect.apply(t, e, ["panelmultiview"]) != null;
			} catch {
				return !1;
			}
		})(), w = p && (C || ge(r)) ? ge(r) ? [
			async () => {
				let t = e.openPopupAtScreenRect, i = e.openPopup;
				if (!s || !p || !V(t) || !V(i)) return !1;
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
		] : ge(r) ? [
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
		throw _(l) ? l : G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", `${i}.openPopup`, l);
	}, N = async (e, t, n) => {
		let r = j(e), i = typeof r.id == "string" && r.id ? r.id : z[e][0];
		return K(r) ? (E(r, t, n, `document.${i}.moveToAnchor`), r) : (await M(r, t, n, `document.${i}`), r);
	}, P = async () => {
		let e = h(), t = e.promiseDocumentFlushed;
		if (V(t)) try {
			await Reflect.apply(t, e, [() => void 0]);
			return;
		} catch {}
		await Promise.resolve();
	}, F = (e, t = 800) => {
		let n = h(), r = U(n, e);
		return H(r) && K(r) ? Promise.resolve(!0) : new Promise((r) => {
			let i = !1, a = (e) => {
				i || (i = !0, r(e));
			}, o = {
				panelId: e,
				resolve: a,
				timeoutHandle: void 0
			}, s = n.setTimeout;
			V(s) ? o.timeoutHandle = Reflect.apply(s, n, [() => {
				m.delete(o);
				let t = U(n, e);
				a(H(t) && K(t));
			}, t]) : queueMicrotask(() => {
				m.delete(o);
				let t = U(n, e);
				a(H(t) && K(t));
			}), m.add(o);
		});
	}, ee = (e, t) => {
		let n = s;
		for (let r of Array.from(m)) if (r.panelId === e) {
			if (m.delete(r), n && V(n.clearTimeout)) try {
				Reflect.apply(n.clearTimeout, n, [r.timeoutHandle]);
			} catch {}
			r.resolve(t);
		}
	}, I = async (e, t) => {
		let n = b(t), r = z[e][0], i = k(n, e);
		O(new Set(z[e])), await P();
		for (let t of z[e]) S(t);
		return u = Object.freeze({
			host: n,
			panelId: r,
			position: i
		}), u;
	}, L = () => {
		let e = s;
		if (!e || !B(e.gPermissionPanel)) return;
		let t = e.gPermissionPanel.setAnchor;
		if (V(t)) try {
			Reflect.apply(t, e.gPermissionPanel, [null, "bottomleft topleft"]);
		} catch {}
	}, R = (e) => {
		let t = Object.freeze({
			open: e,
			type: "native-popup"
		});
		for (let e of Array.from(p)) e(t);
	}, te = (e) => {
		if (c) return;
		let t = Oe(e), n = typeof t?.id == "string" ? t.id : typeof t?.getAttribute == "function" ? t.getAttribute("id") : void 0;
		if (typeof n != "string" || !pe.has(n)) return;
		let r = B(e) ? e.type : void 0;
		if (r === "popupshown") {
			ee(n, !0);
			for (let e of fe) e !== n && C(e);
			if (u && H(t)) try {
				D(t, u.host, u.position, `document.${n}.moveToAnchor`);
			} catch {}
			R(!0);
			return;
		}
		if (r === "popuphidden") {
			if (d.has(n)) return;
			u = null, n === "permission-popup" && L(), C(n), R(!1);
		}
	}, ne = async (e, n) => {
		let r = h(), i = await I(e, n);
		for (let t of z[e]) d.add(t);
		try {
			switch (e) {
				case "site-information":
				case "protections": {
					if (!B(r.gTrustPanelHandler)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gTrustPanelHandler.showPopup");
					try {
						await y(r.gTrustPanelHandler, "showPopup", "window.gTrustPanelHandler.showPopup");
					} catch {}
					let n = x(z[e]);
					return n ? (E(n, i.host, i.position, `document.${n.id ?? i.panelId}.moveToAnchor`), !0) : (await N(e, i.host, i.position), !0);
				}
				case "site-permissions": {
					if (!B(r.gPermissionPanel)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					let n = r.gPermissionPanel.setAnchor;
					if (!V(n)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					try {
						Reflect.apply(n, r.gPermissionPanel, [i.host, i.position]);
					} catch (e) {
						throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor", e);
					}
					try {
						await y(r.gPermissionPanel, "openPopup", "window.gPermissionPanel.openPopup", [Object.freeze({})]);
					} catch {}
					let a = x(z[e]);
					return a ? (E(a, i.host, i.position, "document.permission-popup.moveToAnchor"), !0) : (await N(e, i.host, i.position), !0);
				}
				case "downloads":
					if (!B(r.DownloadsPanel)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.DownloadsPanel.initialize");
					return await y(r.DownloadsPanel, "initialize", "window.DownloadsPanel.initialize"), await N(e, i.host, i.position), !0;
				case "extensions": {
					let n = j(e);
					if (K(n)) {
						w(n, "document.unified-extensions-panel.hidePopup"), u = null;
						for (let t of z[e]) C(t);
						return R(!1), !0;
					}
					if (!B(r.gUnifiedExtensions)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gUnifiedExtensions.togglePanel");
					try {
						await y(r.gUnifiedExtensions, "togglePanel", "window.gUnifiedExtensions.togglePanel");
					} catch {}
					return await N(e, i.host, i.position), !0;
				}
				case "application-menu": {
					let n = j(e);
					if (K(n)) {
						w(n, "document.appMenu-popup.hidePopup"), u = null;
						for (let t of z[e]) C(t);
						return R(!1), !0;
					}
					if (!B(r.PanelUI)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.ensureReady");
					await y(r.PanelUI, "ensureReady", "window.PanelUI.ensureReady");
					let a = r.PanelUI._ensureShortcutsShown;
					if (V(a)) try {
						Reflect.apply(a, r.PanelUI, []);
					} catch {}
					try {
						await N(e, i.host, i.position);
					} catch {}
					let o = A(e);
					if (o && K(o)) return !0;
					if (S("appMenu-popup"), !V(r.PanelUI.show)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.show");
					let s = F("appMenu-popup");
					try {
						let e = Reflect.apply(r.PanelUI.show, r.PanelUI, []);
						Promise.resolve(e).catch(() => {});
					} catch (e) {
						throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.PanelUI.show", e);
					}
					await s;
					let c = A(e);
					return c && K(c) ? (D(c, i.host, i.position, "document.appMenu-popup.moveTo"), !0) : (await N(e, i.host, i.position), !0);
				}
			}
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
		} finally {
			for (let t of z[e]) d.delete(t);
		}
	}, re = Object.freeze({
		invoke: async (e, n) => {
			if (!le(e)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			let r = h();
			l += 1;
			try {
				if (ue(e)) return await ne(e, n);
				switch (e) {
					case "settings": return await y(r, "openPreferences", "window.openPreferences"), !0;
					case "customize":
						if (!B(r.gCustomizeMode)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gCustomizeMode.enter");
						return await y(r.gCustomizeMode, "enter", "window.gCustomizeMode.enter"), !0;
					case "native-toolbar": {
						v();
						let e = U(r, "back-button");
						if (!B(e) || !V(e.focus)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "document.back-button.focus");
						try {
							Reflect.apply(e.focus, e, [Object.freeze({ preventScroll: !0 })]);
						} catch (e) {
							throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.back-button.focus", e);
						}
						return !0;
					}
				}
				throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			} finally {
				--l;
			}
		},
		snapshot() {
			return De(Te(h()));
		},
		subscribe(e) {
			if (h(), typeof e != "function") throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_LISTENER_INVALID", "firefox-browser-tools-subscribe", "browser-tools.subscribe");
			p.add(e);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, p.delete(e), !0) : !1);
		}
	});
	try {
		t.assertRequiredCapabilities(), g();
		let e = h().document;
		if (!ve(e)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", "document.addEventListener.removeEventListener");
		f.push(t.subscribe(e, "popupshown", te, de), t.subscribe(e, "popuphidden", te, de));
	} catch (e) {
		c = !0, s = null;
		for (let e of f.reverse()) try {
			e();
		} catch {}
		throw e;
	}
	return Object.freeze({
		assertRequiredCapabilities: g,
		browserTools: re,
		dispose() {
			if (c) return !1;
			c = !0;
			let e = s;
			u = null, p.clear();
			for (let e of Array.from(m)) m.delete(e), e.resolve(!1);
			if (e) {
				for (let t of fe) {
					let n = U(e, t);
					if (H(n) && K(n)) try {
						Reflect.apply(n.hidePopup, n, []);
					} catch {}
					C(t);
				}
				L();
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
var Ae = "resource://gre/modules/Downloads.sys.mjs", je = 3, Me = (e) => typeof e == "object" && !!e, Ne = (e) => typeof e == "function", Pe = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Fe = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Pe(e),
	phase: n,
	symbol: r
}), Ie = (e) => typeof e == "number" && Number.isFinite(e) && Number.isSafeInteger(e) && e >= 0, Le = (e, t) => {
	if (!Me(t) || typeof t.stopped != "boolean" || typeof t.succeeded != "boolean" || typeof t.canceled != "boolean" || typeof t.hasPartialData != "boolean" || typeof t.hasProgress != "boolean" || !Number.isInteger(t.progress) || t.progress < 0 || t.progress > 100 || !Ie(t.currentBytes) || !Ie(t.totalBytes)) throw Fe(e, "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID", "firefox-downloads-event", "Download");
	return t;
}, Re = (e) => e.stopped ? e.succeeded ? "succeeded" : e.error ? "failed" : e.canceled ? e.hasPartialData ? "paused" : "canceled" : "queued" : "active", ze = (e) => e === "succeeded" || e === "failed" || e === "canceled", Be = (e) => Math.min(e, 999), Ve = () => Object.freeze({
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
function He({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !Me(r) || typeof t != "function" || typeof n != "function") throw Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_OPTIONS_INVALID", "firefox-downloads-create", "ChromeUtils.importESModule");
	let i;
	try {
		i = t(Ae);
	} catch (t) {
		throw Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_MODULE_LOAD_FAILED", "firefox-downloads-module-load", "ChromeUtils.importESModule", t);
	}
	let a = Me(i) ? i.Downloads : void 0, o = a, s = e.snapshot().windowKind === "private" ? "private" : "public", c = s === "private" ? o?.PRIVATE : o?.PUBLIC, l = Object.freeze([
		Object.freeze({
			isAvailable: Me,
			name: "firefox.downloads",
			read: () => a,
			symbol: "Downloads"
		}),
		Object.freeze({
			isAvailable: Ne,
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
	]), u = r, d = null, f = !1, p = null, m = !0, h = 0, g = !1, v = !1, y = 0, x = 0, S = !1, C = Ve(), w = "", T = new Set(), E = e.createHandleRegistry("download"), D = new Map(), O = new WeakSet(), k = [], A = () => {
		if (f || !u) throw Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSED", "firefox-downloads-access", "window");
		if (p) throw p;
		return e.assertOwnsWindow(u), u;
	}, j = () => {
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
			available: Ne(d.addView),
			name: "firefox.downloads-list-add-view",
			requirement: "required",
			symbol: "DownloadList.addView"
		}) }), Object.freeze({ snapshot: Object.freeze({
			available: Ne(d.removeView),
			name: "firefox.downloads-list-remove-view",
			requirement: "required",
			symbol: "DownloadList.removeView"
		}) })), Object.freeze(e);
	}, M = () => {
		A();
		let t = j(), n = t.find((e) => !e.snapshot.available);
		if (n) throw Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, N = (t) => p || (p = _(t) ? t : Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_EVENT_FAILED", "firefox-downloads-event", "DownloadList.view", t), n(p), p), P = (e) => {
		let t = D.get(e);
		if (!t) return !1;
		D.delete(e);
		let n = k.indexOf(e);
		return n !== -1 && k.splice(n, 1), E.release(t.id), !0;
	}, F = (e) => {
		let t = k.indexOf(e);
		for (t !== -1 && k.splice(t, 1), k.unshift(e); k.length > je;) {
			let e = k.pop();
			e && P(e);
		}
	}, ee = (t) => {
		let n = Le(e, t), r = Re(n);
		if (m && (O.add(n), ze(r))) return;
		let i = D.get(n);
		if (!(!i && ze(r) && O.has(n))) {
			if (i || (i = {
				currentBytes: 0,
				download: n,
				hasProgress: !1,
				id: E.register(n),
				order: ++x,
				progressPercent: null,
				state: r,
				totalBytes: 0
			}, D.set(n, i)), i.currentBytes = n.currentBytes, i.hasProgress = n.hasProgress, i.progressPercent = r === "succeeded" ? 100 : n.hasProgress ? n.progress : null, i.state = r, i.totalBytes = n.totalBytes, ze(r)) F(n);
			else {
				let e = k.indexOf(n);
				e !== -1 && k.splice(e, 1);
			}
		}
	}, I = (e) => {
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
	}, L = () => {
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
		})), i = I(e.active), a = Object.freeze({
			active: e.active.length,
			canceled: e.canceled.length,
			failed: e.failed.length,
			paused: e.paused.length,
			queued: e.queued.length,
			succeeded: e.succeeded.length
		}), o = Object.values(a).some((e) => e > 999);
		return Object.freeze({
			activeCount: Be(a.active),
			aggregatePercent: i.percent,
			canceledCount: Be(a.canceled),
			countOverflow: o,
			failedCount: Be(a.failed),
			items: Object.freeze(r),
			pausedCount: Be(a.paused),
			phase: v ? "ready" : "loading",
			progressMode: i.mode,
			queuedCount: Be(a.queued),
			revision: y + 1,
			succeededCount: Be(a.succeeded),
			truncated: n.length > 6 || o
		});
	}, R = () => {
		if (f || p || m || h > 0) {
			g = !0;
			return;
		}
		g = !1;
		let t = L(), n = JSON.stringify({
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
				N(Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_SUBSCRIBER_FAILED", "firefox-downloads-notify", "downloads.subscribe", t));
				return;
			}
		}
	}, te = Object.freeze({
		onDownloadAdded(e) {
			if (!(f || p)) try {
				ee(e), R();
			} catch (e) {
				N(e);
			}
		},
		onDownloadBatchEnded() {
			f || p || (h > 0 && --h, h === 0 && g && R());
		},
		onDownloadBatchStarting() {
			!f && !p && (h += 1);
		},
		onDownloadChanged(e) {
			if (!(f || p)) try {
				ee(e), R();
			} catch (e) {
				N(e);
			}
		},
		onDownloadRemoved(t) {
			if (!(f || p)) try {
				let n = Le(e, t);
				P(n), R();
			} catch (e) {
				N(e);
			}
		}
	}), ne = b(() => {
		!S || !d || (S = !1, Reflect.apply(d.removeView, d, [te]));
	});
	e.assertRequiredCapabilities(), M();
	let re = (async () => {
		try {
			let t = await Reflect.apply(o.getList, o, [c]);
			if (f) return !0;
			if (!Me(t) || !Ne(t.addView) || !Ne(t.removeView)) throw Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", !Me(t) || !Ne(t.addView) ? "DownloadList.addView" : "DownloadList.removeView");
			if (d = t, S = !0, Reflect.apply(d.addView, d, [te]), f) return ne(), !0;
			if (m = !1, h = 0, p) throw p;
			return v = !0, R(), !0;
		} catch (t) {
			if (f) return !0;
			throw p ?? N(_(t) ? t : Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_INITIALIZATION_FAILED", "firefox-downloads-initialize", "Downloads.getList", t));
		}
	})();
	re.catch(() => void 0);
	let ie = Object.freeze({
		ready() {
			return A(), re;
		},
		snapshot() {
			return A(), C;
		},
		subscribe(t) {
			if (A(), typeof t != "function") throw Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_LISTENER_INVALID", "firefox-downloads-subscribe", "downloads.subscribe");
			return T.add(t), b(() => {
				T.delete(t);
			});
		}
	});
	return Object.freeze({
		assertRequiredCapabilities: M,
		dispose() {
			if (f) return !1;
			f = !0, u = null, m = !1, h = 0, g = !1;
			let t;
			try {
				ne();
			} catch (e) {
				t = e;
			}
			T.clear(), D.clear(), k.length = 0;
			try {
				E.dispose();
			} catch (e) {
				t ??= e;
			}
			if (d = null, t !== void 0) throw Fe(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSE_FAILED", "firefox-downloads-dispose", "DownloadList.removeView", t);
			return !0;
		},
		downloads: ie,
		ready() {
			return A(), re;
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
var Ue = 2048, We = 4096, Ge = (e) => {
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
function Ke(e) {
	if (!e || typeof e != "object") throw Ge("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	let t = e;
	if (typeof t.altKey != "boolean" || typeof t.ctrlKey != "boolean" || typeof t.metaKey != "boolean" || typeof t.shiftKey != "boolean" || !Number.isInteger(t.button) || t.button < 0 || t.button > 2) throw Ge("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
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
var qe = Object.freeze({
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
}), Je = Object.freeze(["TabSelect", "TabAttrModified"]), Ye = new Set([
	"busy",
	"label",
	"selected"
]), Xe = "Browser:OpenLocation", Ze = "focusURLBar", Qe = "data-fennevia-healthy", $e = Object.freeze({
	selectAll: !0,
	source: "ctrl-l",
	type: "address-popup-open"
}), et = Object.freeze({ status: "accepted" }), tt = Object.freeze({
	reason: "empty",
	status: "rejected"
}), nt = Object.freeze({
	reason: "too-long",
	status: "rejected"
}), rt = Object.freeze({
	reason: "unsafe-scheme",
	status: "rejected"
}), it = /^\s*(?:data|javascript|vbscript)\s*:/iu, at = new Set([
	"about:blank",
	"about:home",
	"about:newtab",
	"about:privatebrowsing"
]), ot = Object.freeze({
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
}), st = (e) => `document.commands[${e.replaceAll(":", "-")}]`, q = (e) => typeof e == "object" && !!e, J = (e) => typeof e == "function", ct = (e) => q(e) && J(e.addEventListener) && J(e.removeEventListener), lt = (e) => e.gBrowser, ut = (e, t) => {
	let n = lt(e);
	return q(n) ? n[t] : void 0;
}, dt = (e, t) => {
	let n = ut(e, "selectedBrowser");
	return q(n) ? n[t] : void 0;
}, ft = (e, t) => {
	let n = e.BrowserCommands;
	return q(n) ? n[t] : void 0;
}, pt = (e, t) => {
	let n = e.gURLBar;
	return q(n) ? n[t] : void 0;
}, mt = (e, t) => e[t], ht = (e) => {
	let t = e.document;
	return q(t) ? t.documentElement : void 0;
}, gt = (e, t) => {
	let n = e.document;
	if (!(!q(n) || !J(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, _t = (e) => q(e) && J(e.hasAttribute), vt = (e) => ct(e) && typeof e.value == "string" && J(e.getAttribute) && J(e.handleCommand), yt = (e) => q(e) && J(e.getConnectionSecurityInformation), bt = (e) => q(e) && J(e.onContentBlockingEvent), xt = (e) => q(e) && J(e.canHandle), St = (e) => q(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", Ct = (e) => q(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), wt = Object.freeze([
	Object.freeze({
		isAvailable: St,
		name: "firefox.navigation-selected-browser",
		read: (e) => ut(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: Ct,
		name: "firefox.navigation-current-uri",
		read: (e) => dt(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: J,
		name: "firefox.navigation-selected-browser-focus",
		read: (e) => dt(e, "focus"),
		symbol: "window.gBrowser.selectedBrowser.focus"
	}),
	Object.freeze({
		isAvailable: (e) => q(e) && J(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => ut(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: ct,
		name: "firefox.navigation-tab-events",
		read: (e) => ut(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: J,
		name: `firefox.navigation-${e}`,
		read: (e) => ut(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: J,
		name: "firefox.navigation-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: (e) => typeof e == "string",
		name: "firefox.navigation-urlbar-value",
		read: (e) => pt(e, "value"),
		symbol: "window.gURLBar.value"
	}),
	Object.freeze({
		isAvailable: J,
		name: "firefox.navigation-urlbar-submission",
		read: (e) => pt(e, "handleCommand"),
		symbol: "window.gURLBar.handleCommand"
	}),
	Object.freeze({
		isAvailable: J,
		name: "firefox.navigation-urlbar-proxy-state",
		read: (e) => pt(e, "getAttribute"),
		symbol: "window.gURLBar.getAttribute"
	}),
	Object.freeze({
		isAvailable: yt,
		name: "firefox.navigation-connection-security",
		read: (e) => mt(e, "gIdentityHandler"),
		symbol: "window.gIdentityHandler.getConnectionSecurityInformation"
	}),
	Object.freeze({
		isAvailable: bt,
		name: "firefox.navigation-tracking-protection",
		read: (e) => mt(e, "gProtectionsHandler"),
		symbol: "window.gProtectionsHandler.onContentBlockingEvent"
	}),
	Object.freeze({
		isAvailable: xt,
		name: "firefox.navigation-tracking-protection-availability",
		read: (e) => mt(e, "ContentBlockingAllowList"),
		symbol: "window.ContentBlockingAllowList.canHandle"
	}),
	Object.freeze({
		isAvailable: (e) => _t(e) && ct(e),
		name: "firefox.navigation-open-location-command",
		read: (e) => gt(e, Xe),
		symbol: st(Xe)
	}),
	Object.freeze({
		isAvailable: (e) => q(e) && J(e.hasAttribute),
		name: "firefox.navigation-shell-health-gate",
		read: ht,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Object.values(qe).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: _t,
		name: `firefox.navigation-command-${t}`,
		read: (t) => gt(t, e),
		symbol: st(e)
	}), Object.freeze({
		isAvailable: J,
		name: `firefox.navigation-action-${t}`,
		read: (e) => ft(e, t),
		symbol: `window.BrowserCommands.${t}`
	})]),
	Object.freeze({
		isAvailable: J,
		name: "firefox.navigation-action-home",
		read: (e) => ft(e, "home"),
		symbol: "window.BrowserCommands.home"
	}),
	Object.freeze({
		isAvailable: J,
		name: "firefox.navigation-action-reloadOrDuplicate",
		read: (e) => ft(e, "reloadOrDuplicate"),
		symbol: "window.BrowserCommands.reloadOrDuplicate"
	})
]), Tt = (e) => Object.freeze(wt.map((t) => {
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
})), Et = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Y = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Et(e),
	phase: n,
	symbol: r
}), Dt = (e, t) => e.addressValue === t.addressValue && e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.connectionSecurity === t.connectionSecurity && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title && e.trackingProtection === t.trackingProtection, Ot = (e) => {
	if (!q(e) || !q(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Ye.has(e));
};
function kt({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !q(n) || typeof t != "function") throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID", "firefox-navigation-create", "window");
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
		if (i || !r) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSED", "firefox-navigation-access", "window.gBrowser.selectedBrowser");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, m = () => {
		let t = p().gBrowser;
		if (!q(t)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gBrowser");
		return t;
	}, h = () => {
		let t = m().selectedBrowser;
		if (!St(t)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, g = () => {
		let t = m().selectedTab;
		if (!q(t) || !J(t.getAttribute)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, v = (t) => {
		let n = gt(p(), t);
		if (!_t(n)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", st(t));
		return n;
	}, y = () => {
		let t = p().gURLBar;
		if (!vt(t)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gURLBar.handleCommand");
		return t;
	}, x = () => {
		let t = p().gIdentityHandler;
		if (!yt(t)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gIdentityHandler.getConnectionSecurityInformation");
		return t;
	}, S = () => {
		let t = p().gProtectionsHandler;
		if (!bt(t)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gProtectionsHandler.onContentBlockingEvent");
		return t;
	}, C = () => {
		let t = p().ContentBlockingAllowList;
		if (!xt(t)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.ContentBlockingAllowList.canHandle");
		return t;
	}, w = () => {
		let t = Tt(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (e) => {
		let t = v(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, E = (t) => {
		let n = t.currentURI;
		if (!Ct(n)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, Ue);
	}, D = (e) => {
		if (at.has(e)) return "";
		let t = y();
		return (Reflect.apply(t.getAttribute, t, ["pageproxystate"]) === "valid" ? t.value : e).slice(0, We);
	}, O = () => {
		let e = x(), t = Reflect.apply(e.getConnectionSecurityInformation, e, []);
		return typeof t == "string" ? ot[t] ?? "unavailable" : "unavailable";
	}, k = (e) => {
		let t = C();
		if (Reflect.apply(t.canHandle, t, [e]) !== !0) return "unavailable";
		let n = S();
		return typeof n.hasException != "boolean" || typeof n.anyBlocking != "boolean" || typeof n.anyDetected != "boolean" ? "unavailable" : n.hasException ? "exception" : n.anyBlocking ? "blocking" : n.anyDetected ? "detected" : "no-trackers-detected";
	}, A = () => {
		let e = h(), t = g(), n = E(e);
		return Object.freeze({
			addressValue: D(n),
			canGoBack: T(qe.back.id),
			canGoForward: T(qe.forward.id),
			connectionSecurity: O(),
			displayUri: n,
			loading: T(qe.stop.id),
			title: String(Reflect.apply(t.getAttribute, t, ["label"]) ?? "").slice(0, 256),
			trackingProtection: k(e)
		});
	}, j = () => {
		let n = Object.freeze({
			revision: o,
			snapshot: s,
			type: "snapshot"
		});
		for (let r of Array.from(d)) try {
			r(n);
		} catch (n) {
			t(Y(e, "FENNEVIA_FIREFOX_NAVIGATION_SUBSCRIBER_FAILED", "firefox-navigation-notify", "navigation.subscribe", n));
		}
	}, M = (e) => {
		let t = A();
		return Dt(s, t) && o > 0 ? !1 : (s = t, o += 1, e && j(), !0);
	}, N = (n, r) => {
		a = _(n) ? n : Y(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, P = (e) => {
		if (!(i || a)) try {
			M(!0);
		} catch (t) {
			N(t, e);
		}
	}, F = (e, t, n) => {
		if (!(i || a)) try {
			e === m().selectedBrowser && q(t) && t.isTopLevel === !0 && M(!0);
		} catch (e) {
			N(e, n);
		}
	}, ee = Object.freeze({
		onLocationChange(e, t) {
			F(e, t, "window.gBrowser.onLocationChange");
		},
		onStateChange(e, t) {
			F(e, t, "window.gBrowser.onStateChange");
		},
		onSecurityChange(e, t) {
			F(e, t, "window.gBrowser.onSecurityChange");
		},
		onContentBlockingEvent(e, t) {
			F(e, t, "window.gBrowser.onContentBlockingEvent");
		}
	}), I = (e) => ({
		altKey: e.altKey,
		button: e.button,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		preventDefault() {},
		shiftKey: e.shiftKey
	}), L = (t, n) => {
		let r = p().BrowserCommands, i = q(r) ? r[t] : void 0;
		if (!J(i)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${t}`);
		try {
			return Reflect.apply(i, r, n === void 0 ? [] : [I(n)]), !0;
		} catch (n) {
			throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${t}`, n);
		}
	}, R = (e, t = !0, n) => {
		let r = qe[e];
		h();
		let i = v(r.id);
		return t && Reflect.apply(i.hasAttribute, i, ["disabled"]) ? !1 : L(r.method, n);
	}, te = (t) => {
		if (typeof t != "string") return tt;
		if (t.length > 4096) return nt;
		if (t.trim().length === 0) return tt;
		if (it.test(t)) return rt;
		h();
		let n = y();
		try {
			return n.value = t, Reflect.apply(n.handleCommand, n, []), et;
		} catch (t) {
			throw Y(e, "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED", "firefox-address-submit", "window.gURLBar.handleCommand", t);
		}
	}, ne = () => {
		let e = ht(p());
		return q(e) && J(e.hasAttribute) && !!Reflect.apply(e.hasAttribute, e, [Qe]);
	}, re = (e) => {
		if (!q(e) || !q(e.sourceEvent)) return !1;
		let t = e.sourceEvent.target;
		return q(t) && t.id === Ze;
	}, ie = (e) => {
		if (!(i || a)) try {
			if (!ne() || !re(e) || f.size === 0) return;
			M(!0);
			let t = !1;
			for (let e of Array.from(f)) t = e($e) === !0 || t;
			if (!t || !q(e)) return;
			J(e.preventDefault) && Reflect.apply(e.preventDefault, e, []), J(e.stopPropagation) && Reflect.apply(e.stopPropagation, e, []);
		} catch (e) {
			N(e, st(Xe));
		}
	}, ae = Object.freeze({
		back: (e) => R("back", !0, e === void 0 ? void 0 : Ke(e)),
		focusContent() {
			let t = h(), n = t.focus;
			if (!J(n)) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus");
			try {
				return Reflect.apply(n, t, []), !0;
			} catch (t) {
				throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus", t);
			}
		},
		forward: (e) => R("forward", !0, e === void 0 ? void 0 : Ke(e)),
		home(e) {
			return h(), L("home", e === void 0 ? void 0 : Ke(e));
		},
		newTab: () => R("newTab", !1),
		reload(e) {
			return e === void 0 ? R("reload") : (h(), L("reloadOrDuplicate", Ke(e)));
		},
		reloadOrStop() {
			let e = T(qe.stop.id) ? "stop" : "reload";
			return R(e), e;
		},
		snapshot() {
			return p(), s;
		},
		stop: () => R("stop"),
		submitAddress: te,
		subscribe(t) {
			if (p(), typeof t != "function") throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_LISTENER_INVALID", "firefox-navigation-subscribe", "navigation.subscribe");
			return d.add(t), b(() => {
				d.delete(t);
			});
		},
		subscribeAddressPopupOpen(t) {
			if (p(), typeof t != "function") throw Y(e, "FENNEVIA_FIREFOX_ADDRESS_POPUP_LISTENER_INVALID", "firefox-address-popup-subscribe", "navigation.subscribeAddressPopupOpen");
			return f.add(t), b(() => {
				f.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), M(!1);
		let t = m().tabContainer;
		for (let n of Je) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (q(e) && e.target !== m().selectedTab || !Ot(e))) return;
				M(!0);
			} catch (e) {
				N(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		u.push(e.subscribe(v(Xe), "command", ie));
		let n = m();
		Reflect.apply(n.addTabsProgressListener, n, [ee]), l = !0;
		let r = p().MutationObserver;
		c = new r(() => {
			P("document.command.disabled");
		});
		for (let { id: e } of Object.values(qe)) c.observe(v(e), {
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
			let e = q(r.gBrowser) ? r.gBrowser : null;
			e && J(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [ee]);
		} catch (e) {
			a ??= e;
		}
		l = !1;
		for (let e of u.reverse()) try {
			e();
		} catch (e) {
			a ??= e;
		}
		throw r = null, a !== void 0 && t(Y(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", a)), n;
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
				let e = q(r.gBrowser) ? r.gBrowser : null;
				if (!e || !J(e.removeTabsProgressListener)) throw TypeError("FENNEVIA_FIREFOX_NAVIGATION_PROGRESS_DISPOSER_INVALID");
				Reflect.apply(e.removeTabsProgressListener, e, [ee]);
			} catch (e) {
				t ??= e;
			}
			l = !1;
			for (let e of u.reverse()) try {
				e();
			} catch (e) {
				t ??= e;
			}
			if (u.length = 0, d.clear(), f.clear(), r = null, t !== void 0) throw Y(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", t);
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
//#region src/app/tab-state.ts
var At = Object.freeze([
	"playing",
	"muted",
	"blocked"
]), jt = Object.freeze([
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
new Set(At);
var Mt = new Set(jt);
function Nt(e) {
	return typeof e == "string" && Mt.has(e);
}
//#endregion
//#region src/firefox/tabs.ts
var Pt = Object.freeze([
	"TabOpen",
	"TabClose",
	"TabSelect",
	"TabMove",
	"TabPinned",
	"TabUnpinned",
	"TabAttrModified"
]), Ft = new Set([
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
]), It = 262144, Lt = 1e5, Rt = "resource://gre/modules/ContextualIdentityService.sys.mjs", zt = /[\s"'<>\\]/u, Bt = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, Vt = Object.freeze({
	toolbar: "gray",
	turquoise: "cyan"
}), Ht = (e) => typeof e == "object" && !!e || typeof e == "function", X = (e) => typeof e == "object" && !!e, Z = (e) => typeof e == "function", Ut = (e) => e.gBrowser, Wt = (e, t) => {
	let n = Ut(e);
	return X(n) ? n[t] : void 0;
}, Gt = (e, t) => {
	let n = e.document;
	if (!(!X(n) || !Z(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Kt = (e) => X(e) && Z(e.openPopup) && Z(e.moveTo) && Z(e.addEventListener) && Z(e.removeEventListener), qt = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => Wt(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: Ht,
		name: "firefox.selected-tab",
		read: (e) => Wt(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab"
	}),
	...[
		["add-tab", "addTrustedTab"],
		["remove-tab", "removeTab"],
		["pin-tab", "pinTab"],
		["unpin-tab", "unpinTab"],
		["move-tab", "moveTabTo"]
	].map(([e, t]) => Object.freeze({
		isAvailable: Z,
		name: `firefox.${e}`,
		read: (e) => Wt(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: (e) => typeof e == "string" && e.length > 0 && e.length <= 2048,
		name: "firefox.new-tab-url",
		read: (e) => e.BROWSER_NEW_TAB_URL,
		symbol: "window.BROWSER_NEW_TAB_URL"
	}),
	Object.freeze({
		isAvailable: Kt,
		name: "firefox.tab-context-menu",
		read: (e) => Gt(e, "tabContextMenu"),
		symbol: "document.tabContextMenu.openPopup.moveTo"
	})
]), Jt = (e) => Object.freeze(qt.map((t) => {
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
})), Yt = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Q = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Yt(e),
	phase: n,
	symbol: r
}), Xt = (e, t) => {
	if (!X(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw Q(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, Zt = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !zt.test(e) || e.length <= It && Bt.test(e))) return e;
}, Qt = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl && e.audio === r.audio && e.attention === r.attention && e.pictureInPicture === r.pictureInPicture && e.container?.color === r.container?.color && e.container?.label === r.container?.label;
}), $t = (e) => {
	if (!X(e) || !X(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Ft.has(e));
}, en = (e) => {
	if (typeof e != "string" || e.length === 0) return;
	let t = Vt[e] ?? e;
	return Nt(t) ? t : void 0;
}, tn = (e, t) => !X(e) || e.target === void 0 || e.target === t || X(e.target) && e.target.id === "tabContextMenu";
function nn({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !X(r) || typeof n != "function") throw Q(e, "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID", "firefox-tabs-create", "window");
	let i = r, a = !1, o = null, s = 0, c = Object.freeze([]), l = new Set(), u = new Set(), d = [], f = e.createHandleRegistry("tab"), p = null, m = null;
	if (typeof t == "function") try {
		let e = t(Rt), n = X(e) ? e.ContextualIdentityService : void 0;
		X(n) && Z(n.getPublicIdentityFromId) && (p = n);
	} catch {
		p = null;
	}
	let h = () => {
		if (a || !i) throw Q(e, "FENNEVIA_FIREFOX_TABS_DISPOSED", "firefox-tabs-access", "window.gBrowser.openTabs");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, g = () => {
		let t = h().gBrowser;
		if (!X(t)) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "window.gBrowser");
		return t;
	}, v = () => {
		let t = Jt(h()), n = t.find((e) => !e.snapshot.available);
		if (n) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, y = () => {
		let t = g().openTabs;
		if (!Array.isArray(t)) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = t.map((t) => Xt(e, t));
		if (new Set(n).size !== n.length) throw Q(e, "FENNEVIA_FIREFOX_TAB_ORDER_INVALID", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
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
		if (!X(n)) return;
		let r = en(n.color);
		if (!r) return;
		let i = "";
		if (typeof n.name == "string" && (i = n.name), i.trim().length === 0 && Z(p.getUserContextLabel)) try {
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
		let n = String(x(e, "label") ?? "").slice(0, 256), r = Zt(x(e, "image")), i = C(e), a = w(e);
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
			n(Q(e, "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED", "firefox-tabs-notify", "tabs.subscribe", t));
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
		return !Qt(c, i) && (c = i, s += 1, e && D(), !0);
	}, k = (t, r) => {
		o = _(t) ? t : Q(e, "FENNEVIA_FIREFOX_TABS_EVENT_FAILED", "firefox-tabs-event", `window.gBrowser.tabContainer.${r}`, t), n(o);
	}, A = (t) => {
		h();
		let n = f.resolve(t);
		if (!y().includes(n)) throw f.release(t), l.delete(t), Q(e, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-action", "tab.opaque-id");
		return n;
	}, j = (t, n) => {
		let r = g(), i = r[t];
		if (typeof i != "function") throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", `window.gBrowser.${t}`);
		return Reflect.apply(i, r, n);
	}, M = (t) => {
		if (t === void 0) return Object.freeze({ selected: !0 });
		if (!X(t) || Object.keys(t).some((e) => e !== "selected") || t.selected !== void 0 && typeof t.selected != "boolean") throw Q(e, "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID", "firefox-tabs-action", "tabs.open.options");
		return Object.freeze({ selected: t.selected ?? !0 });
	}, N = (t) => {
		if (!X(t) || Object.keys(t).some((e) => e !== "screenX" && e !== "screenY") || typeof t.screenX != "number" || typeof t.screenY != "number" || !Number.isFinite(t.screenX) || !Number.isFinite(t.screenY) || Math.abs(t.screenX) > Lt || Math.abs(t.screenY) > Lt) throw Q(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POINT_INVALID", "firefox-tabs-action", "tabs.openContextMenu.point");
		return Object.freeze({
			screenX: t.screenX,
			screenY: t.screenY
		});
	}, P = () => {
		if (h(), !m || !Kt(m)) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
		return m;
	}, F = Object.freeze({
		close(e) {
			let t = A(e);
			j("removeTab", [t, {
				animate: !0,
				isUserTriggered: !0
			}]), O(!0);
		},
		move(t, n) {
			let r = A(t);
			if (!Number.isSafeInteger(n) || n < 0 || n > 1e4) throw Q(e, "FENNEVIA_FIREFOX_TAB_MOVE_INDEX_INVALID", "firefox-tabs-action", "tabs.move.index");
			j("moveTabTo", [r, {
				isUserTriggered: !0,
				tabIndex: n
			}]), O(!0);
		},
		open(t) {
			let n = M(t), r = h().BROWSER_NEW_TAB_URL;
			if (typeof r != "string" || r.length === 0) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.BROWSER_NEW_TAB_URL");
			let i = Xt(e, j("addTrustedTab", [r, { inBackground: !n.selected }]));
			if (!y().includes(i)) throw Q(e, "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED", "firefox-tabs-action", "window.gBrowser.addTrustedTab");
			let a = f.register(i);
			if (O(!0), n.selected && g().selectedTab !== i) throw Q(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			return a;
		},
		openContextMenu(t, r) {
			let i = A(t), a = N(r), o = P(), s = o.openPopup, c = o.moveTo;
			if (!Z(s) || !Z(c)) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
			try {
				Reflect.apply(s, o, [
					i,
					"after_start",
					0,
					0,
					!0
				]);
			} catch (t) {
				throw Q(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_REJECTED", "firefox-tabs-action", "document.tabContextMenu.openPopup", t);
			}
			try {
				Reflect.apply(c, o, [a.screenX, a.screenY]);
			} catch (t) {
				n(Q(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POSITION_FAILED", "firefox-tabs-action", "document.tabContextMenu.moveTo", t));
			}
		},
		pin(t) {
			let n = A(t);
			if (!S(n, "pinned")) {
				if (j("pinTab", [n]), !S(n, "pinned")) throw Q(e, "FENNEVIA_FIREFOX_TAB_PIN_REJECTED", "firefox-tabs-action", "window.gBrowser.pinTab");
				O(!0);
			}
		},
		select(t) {
			let n = A(t), r = g();
			if (r.selectedTab !== n) {
				if (!Reflect.set(r, "selectedTab", n) || r.selectedTab !== n) throw Q(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
				O(!0);
			}
		},
		snapshot() {
			return h(), c;
		},
		subscribe(t) {
			if (h(), typeof t != "function") throw Q(e, "FENNEVIA_FIREFOX_TABS_LISTENER_INVALID", "firefox-tabs-subscribe", "tabs.subscribe");
			return u.add(t), b(() => {
				u.delete(t);
			});
		},
		toggleMute(t) {
			let n = A(t), r = n.toggleMuteAudio;
			if (!Z(r)) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "MozTabbrowserTab.toggleMuteAudio");
			Reflect.apply(r, n, []), O(!0);
		},
		unpin(t) {
			let n = A(t);
			if (S(n, "pinned")) {
				if (j("unpinTab", [n]), S(n, "pinned")) throw Q(e, "FENNEVIA_FIREFOX_TAB_UNPIN_REJECTED", "firefox-tabs-action", "window.gBrowser.unpinTab");
				O(!0);
			}
		}
	});
	try {
		e.assertRequiredCapabilities(), v(), O(!1);
		let t = g().tabContainer;
		for (let n of Pt) d.push(e.subscribe(t, n, (e) => {
			if (!(a || o)) try {
				if (n === "TabAttrModified" && !$t(e)) return;
				O(!0);
			} catch (e) {
				k(e, n);
			}
		}));
		let n = Gt(h(), "tabContextMenu");
		if (!Kt(n)) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "document.tabContextMenu.openPopup.moveTo");
		m = n, d.push(e.subscribe(n, "popupshown", (e) => {
			a || o || !tn(e, n) || E(Object.freeze({
				open: !0,
				type: "context-menu"
			}));
		})), d.push(e.subscribe(n, "popuphidden", (e) => {
			a || !tn(e, n) || E(Object.freeze({
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
		throw r !== void 0 && n(Q(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", r)), t;
	}
	return Object.freeze({
		assertRequiredCapabilities: v,
		dispose() {
			if (a) return !1;
			a = !0, i = null;
			let t, n = m?.hidePopup;
			if (m && Z(n)) try {
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
			if (t !== void 0) throw Q(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", t);
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
		tabs: F
	});
}
//#endregion
//#region src/app/urlbar-coverage-state.ts
var rn = Object.freeze([
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
]), an = Object.freeze([
	"location",
	"media",
	"serial",
	"xr"
]), on = Object.freeze([
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
new Set(rn), new Set(an), new Set(on);
//#endregion
//#region src/firefox/urlbar-coverage.ts
var sn = Object.freeze([
	"blocked-permissions-container",
	"identity-permission-box",
	"page-action-buttons"
]), cn = Object.freeze({
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
}), ln = Object.freeze([
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
]), un = Object.freeze([
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
]), dn = new Set([
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
]), fn = (e) => typeof e == "object" && !!e, pn = (e) => typeof e == "function", mn = (e) => fn(e) && pn(e.getAttribute) && pn(e.hasAttribute), hn = (e) => fn(e) && pn(e.getElementById), gn = (e) => hn(e.document) ? e.document : null, _n = (e, t) => {
	let n = gn(e);
	return n ? Reflect.apply(n.getElementById, n, [t]) : void 0;
}, vn = (e) => gn(e)?.documentElement, yn = Object.freeze([
	Object.freeze({
		isAvailable: pn,
		name: "firefox.urlbar-coverage-native-access",
		read: (e) => e.openLocation,
		symbol: "window.openLocation"
	}),
	Object.freeze({
		isAvailable: pn,
		name: "firefox.urlbar-coverage-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: mn,
		name: "firefox.urlbar-coverage-urlbar-state",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.hasAttribute"
	}),
	Object.freeze({
		isAvailable: mn,
		name: "firefox.urlbar-coverage-window-state",
		read: vn,
		symbol: "document.documentElement.hasAttribute"
	}),
	...sn.map((e) => Object.freeze({
		isAvailable: mn,
		name: `firefox.urlbar-coverage-${e}`,
		read: (t) => _n(t, e),
		symbol: `document.elements[${e}]`
	}))
]), bn = (e, t) => Object.freeze([...yn.map((t) => {
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
	available: pn(t),
	name: "firefox.urlbar-coverage-native-ui-handoff",
	requirement: "required",
	symbol: "nativeUi.revealForUrlbar"
}) })]), xn = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, $ = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: xn(e),
	phase: n,
	symbol: r
}), Sn = (e, t) => {
	let n = Reflect.apply(e.getAttribute, e, [t]);
	return typeof n == "string" ? n : null;
}, Cn = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), wn = (e) => {
	if (e.hidden === !0) return !1;
	let t = Sn(e, "hidden");
	return t !== null && t !== "false" ? !1 : Sn(e, "collapsed") !== "true";
}, Tn = (e) => {
	let t = e.children;
	return Object.freeze(!t || typeof t != "object" && !Array.isArray(t) ? [] : Array.from(t));
}, En = (e, t) => {
	let n = e.classList;
	return fn(n) && pn(n.contains) && !!Reflect.apply(n.contains, n, [t]);
}, Dn = (e, t) => e.permissions.available === t.permissions.available && e.permissions.hasPermissions === t.permissions.hasPermissions && e.permissions.blocked.length === t.permissions.blocked.length && e.permissions.blocked.every((e, n) => e === t.permissions.blocked[n]) && e.permissions.sharing.length === t.permissions.sharing.length && e.permissions.sharing.every((e, n) => e === t.permissions.sharing[n]) && e.items.length === t.items.length && e.items.every((e, n) => e === t.items[n]);
function On({ boundary: e, onError: t, requestNativeUiReveal: n, window: r }) {
	if (e.assertOwnsWindow(r), !fn(r) || typeof t != "function" || typeof n != "function") throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_OPTIONS_INVALID", "firefox-urlbar-coverage-create", "window");
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
		let n = _n(d(), t);
		if (!mn(n)) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", `document.elements[${t}]`);
		return n;
	}, p = () => {
		let t = d().gURLBar;
		if (!mn(t)) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "window.gURLBar.hasAttribute");
		return t;
	}, m = () => {
		let t = vn(d());
		if (!mn(t)) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "document.documentElement.hasAttribute");
		return t;
	}, h = () => {
		let t = bn(d(), n), r = t.find((e) => !e.snapshot.available);
		if (r) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-capability", r.snapshot.symbol, r.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, g = () => {
		let e = p(), t = f("identity-permission-box"), n = Object.freeze(ln.flatMap(({ id: e, kind: t }) => {
			let n = _n(d(), e);
			return mn(n) && Cn(n, "sharing") ? [t] : [];
		}));
		if (!(Sn(e, "pageproxystate") === "valid" || Cn(e, "persistsearchterms") || n.length > 0)) return Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		});
		let r = Object.freeze(Tn(f("blocked-permissions-container")).flatMap((e) => {
			if (!mn(e) || !Cn(e, "showing")) return [];
			let t = Sn(e, "data-permission-id"), n = t ? cn[t] : void 0;
			return n ? [n] : [];
		}));
		return Object.freeze({
			available: !0,
			blocked: r,
			hasPermissions: Cn(t, "hasPermissions"),
			sharing: n
		});
	}, v = () => {
		let e = d(), t = p(), n = new Set();
		Cn(m(), "remotecontrol") && n.add("remote-control"), Cn(t, "searchmode") && n.add("search-mode"), Cn(t, "persistsearchterms") && n.add("persisted-search");
		for (let { id: t, kind: r } of un) {
			let i = _n(e, t);
			mn(i) && wn(i) && n.add(r);
		}
		let r = _n(e, "pageActionButton");
		mn(r) && Cn(r, "multiple-children") && n.add("more-page-actions");
		for (let e of Tn(f("page-action-buttons"))) {
			if (!mn(e) || !wn(e) || !En(e, "urlbar-page-action")) continue;
			let t = typeof e.id == "string" ? e.id : "";
			dn.has(t) || (En(e, "urlbar-addon-page-action") ? n.add("extension-actions") : Cn(e, "actionid") && n.add("other-page-actions"));
		}
		return Object.freeze(on.filter((e) => n.has(e)));
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
		return Dn(l, t) && s > 0 ? !1 : (l = t, s += 1, e && x(), !0);
	}, C = (n) => {
		o = _(n) ? n : $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_EVENT_FAILED", "firefox-urlbar-coverage-event", "window.MutationObserver", n), t(o);
	}, w = Object.freeze({
		openNativeUrlbar() {
			let t = d(), r = t.openLocation;
			if (!pn(r)) throw $(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-native-access", "window.openLocation");
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
var kn = Object.freeze([
	"close",
	"minimize",
	"toggle-maximize"
]), An = new Set(kn);
function jn(e) {
	return typeof e == "string" && An.has(e);
}
//#endregion
//#region src/firefox/window-controls.ts
var Mn = (e) => typeof e == "object" && !!e, Nn = (e) => typeof e == "function", Pn = (e, t) => {
	let n = e.document;
	if (!(!Mn(n) || !Nn(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Fn = (e) => Object.freeze(e), In = Object.freeze([
	Fn({
		isAvailable: Nn,
		name: "window-controls.minimize",
		read: (e) => e.minimize,
		symbol: "window.minimize"
	}),
	Fn({
		isAvailable: Nn,
		name: "window-controls.maximize",
		read: (e) => e.maximize,
		symbol: "window.maximize"
	}),
	Fn({
		isAvailable: Nn,
		name: "window-controls.restore",
		read: (e) => e.restore,
		symbol: "window.restore"
	}),
	Fn({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.window-state",
		read: (e) => e.windowState,
		symbol: "window.windowState"
	}),
	Fn({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.state-maximized",
		read: (e) => e.STATE_MAXIMIZED,
		symbol: "window.STATE_MAXIMIZED"
	}),
	Fn({
		isAvailable: Nn,
		name: "window-controls.sizemode-events",
		read: (e) => e.addEventListener,
		symbol: "window.addEventListener"
	}),
	Fn({
		isAvailable: (e) => Mn(e) && Nn(e.doCommand),
		name: "window-controls.close-command",
		read: (e) => Pn(e, "cmd_closeWindow"),
		symbol: "document.cmd_closeWindow.doCommand"
	})
]), Ln = (e) => Object.freeze(In.map((t) => {
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
})), Rn = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, zn = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Rn(e),
	phase: n,
	symbol: r
}), Bn = (e) => {
	let t = e.windowState === e.STATE_MAXIMIZED || typeof e.STATE_FULLSCREEN == "number" && e.windowState === e.STATE_FULLSCREEN;
	return Object.freeze({ maximized: t });
};
function Vn({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !Mn(n) || typeof t != "function") throw zn(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_OPTIONS_INVALID", "firefox-window-controls-create", "window");
	let r = n, i = !1, a = new Set(), o, s = () => {
		if (i || !r) throw zn(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_DISPOSED", "firefox-window-controls-access", "window");
		return r;
	}, c = () => {
		let t = Ln(s()), n = t.find((e) => !e.snapshot.available);
		if (n) throw zn(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, l = () => {
		let n;
		try {
			n = Bn(s());
		} catch (e) {
			t(e);
			return;
		}
		for (let r of Array.from(a)) try {
			r(n);
		} catch (n) {
			t(zn(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBER_FAILED", "firefox-window-controls-notify", "windowControls.subscribe", n));
		}
	}, u = (t) => {
		if (!jn(t)) throw zn(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_INVALID", "firefox-window-controls-action", "windowControls.action");
		c();
		let n = s();
		try {
			if (t === "minimize") return Reflect.apply(n.minimize, n, []), !0;
			if (t === "toggle-maximize") return Bn(n).maximized ? Reflect.apply(n.restore, n, []) : Reflect.apply(n.maximize, n, []), !0;
			let r = Pn(n, "cmd_closeWindow");
			if (!Mn(r) || !Nn(r.doCommand)) throw zn(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-action", "document.cmd_closeWindow.doCommand");
			return Reflect.apply(r.doCommand, r, []), !0;
		} catch (n) {
			throw n instanceof g ? n : zn(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_FAILED", "firefox-window-controls-action", t === "close" ? "document.cmd_closeWindow.doCommand" : `window.${t}`, n);
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
		throw zn(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBE_FAILED", "firefox-window-controls-subscribe", "window.addEventListener", t);
	}
	let d = Object.freeze({
		invoke: u,
		snapshot() {
			return Bn(s());
		},
		subscribe(t) {
			if (typeof t != "function") throw zn(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_LISTENER_INVALID", "firefox-window-controls-subscribe", "windowControls.subscribe");
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
export { g as FirefoxBridgeError, ie as createFirefoxBookmarksBridge, T as createFirefoxBridgeBoundary, ke as createFirefoxBrowserToolsBridge, He as createFirefoxDownloadsBridge, kt as createFirefoxNavigationBridge, nn as createFirefoxTabsBridge, On as createFirefoxUrlbarCoverageBridge, Vn as createFirefoxWindowControlsBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, _ as isFirefoxBridgeError, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic };
