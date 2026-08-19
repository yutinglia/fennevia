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
]), P = (e) => typeof e == "object" && !!e, ee = (e) => typeof e == "function", te = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, F = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: te(e),
	phase: n,
	symbol: r
}), I = (e, t, n, r) => {
	if (typeof t != "string" || !M.test(t)) throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_GUID_INVALID", n, r);
	return t;
}, L = (e) => {
	let t = "", n = 0;
	for (let r of e) {
		if (n >= 160) break;
		t += r, n += 1;
	}
	return t;
}, ne = (e, t, n, r, i) => {
	if (!P(t) || typeof t.guid != "string" || typeof t.parentGuid != "string" || typeof t.index != "number" || !Number.isSafeInteger(t.index) || t.index < 0 || typeof t.type != "number" || typeof t.title != "string" || (I(e, t.guid, r, "PlacesUtils.bookmarks.fetch.result.guid"), I(e, t.parentGuid, r, "PlacesUtils.bookmarks.fetch.result.parentGuid"), i !== void 0 && t.guid !== i || ![
		n.TYPE_BOOKMARK,
		n.TYPE_FOLDER,
		n.TYPE_SEPARATOR
	].includes(t.type) || t.type === n.TYPE_FOLDER && (!Number.isSafeInteger(t.childCount) || t.childCount < 0))) throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID", r, "PlacesUtils.bookmarks.fetch.result");
	return t;
}, re = (e, t, n) => {
	if (t.type === n.TYPE_BOOKMARK) return "bookmark";
	if (t.type === n.TYPE_FOLDER) return "folder";
	if (t.type === n.TYPE_SEPARATOR) return "separator";
	throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_TYPE_INVALID", "firefox-bookmarks-snapshot", "PlacesUtils.bookmarks.TYPE_BOOKMARK");
}, ie = (e) => {
	if (!P(e) || typeof e.href != "string") return null;
	if (typeof e.protocol == "string") return e.protocol.toLowerCase();
	let t = e.href.indexOf(":");
	return t > 0 ? `${e.href.slice(0, t).toLowerCase()}:` : null;
};
function ae({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !P(r) || typeof t != "function" || typeof n != "function") throw F(e, "FENNEVIA_FIREFOX_BOOKMARKS_OPTIONS_INVALID", "firefox-bookmarks-create", "ChromeUtils.importESModule");
	let i, a;
	try {
		i = t(E), a = t(D);
	} catch (t) {
		throw F(e, "FENNEVIA_FIREFOX_BOOKMARKS_MODULE_LOAD_FAILED", "firefox-bookmarks-module-load", "ChromeUtils.importESModule", t);
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
			isAvailable: ee,
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
			isAvailable: ee,
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
			isAvailable: ee,
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
			isAvailable: ee,
			name: "firefox.places-node-conversion",
			read: () => l?.promiseNodeLikeFromFetchInfo,
			symbol: "PlacesUIUtils.promiseNodeLikeFromFetchInfo"
		}),
		Object.freeze({
			isAvailable: ee,
			name: "firefox.places-open-node",
			read: () => l?.openNodeIn,
			symbol: "PlacesUIUtils.openNodeIn"
		})
	]), d = r, f = !1, p = null, m = !1, h = 0, g = new Set(), v = e.createHandleRegistry("bookmark"), y = new Map(), x = new Map(), S = () => {
		if (f || !d) throw F(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSED", "firefox-bookmarks-access", "window");
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
		if (n) throw F(e, "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING", "firefox-bookmarks-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (t) => {
		S();
		let n = I(e, t, "firefox-bookmarks-handle", "PlacesUtils.bookmarks.guid"), r = x.get(n);
		if (r) return r;
		let i = Object.freeze({ guid: n }), a = v.register(i);
		return y.set(n, i), x.set(n, a), a;
	}, te = (e) => {
		if (typeof e != "string" || !M.test(e)) return !1;
		let t = x.get(e);
		if (!t) return !1;
		x.delete(e), y.delete(e);
		try {
			return v.release(t);
		} catch {
			return !1;
		}
	}, ae = (e) => (S(), v.resolve(e).guid), oe = (t, n = t.title) => {
		let r = re(e, t, c.bookmarks);
		return Object.freeze({
			hasChildren: r === "folder" && Number.isSafeInteger(t.childCount) && t.childCount > 0,
			id: T(t.guid),
			kind: r,
			title: L(n)
		});
	}, se = async (t, n) => {
		S();
		let r;
		try {
			r = await Reflect.apply(c.bookmarks.fetch, c.bookmarks, [t]);
		} catch (t) {
			throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_FAILED", n, "PlacesUtils.bookmarks.fetch", t);
		}
		return S(), r === null ? null : ne(e, r, c.bookmarks, n, "guid" in t ? t.guid : void 0);
	}, ce = (t, r) => {
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
			n(F(e, "FENNEVIA_FIREFOX_BOOKMARKS_SUBSCRIBER_FAILED", "firefox-bookmarks-notify", "bookmarks.subscribe", t));
		}
	}, le = (t) => {
		p = _(t) ? t : F(e, "FENNEVIA_FIREFOX_BOOKMARKS_OBSERVER_FAILED", "firefox-bookmarks-observer", "PlacesUtils.observers.addListener", t), n(p);
	}, ue = (t) => {
		if (!(f || p)) try {
			if (!Array.isArray(t)) throw F(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEventCallback.events");
			if (t.length > A) {
				ce(Object.freeze([]), "all");
				return;
			}
			let n = new Set(), r = [];
			for (let i of t) {
				if (!P(i) || typeof i.type != "string" || !O.includes(i.type) || typeof i.parentGuid != "string" || typeof i.isTagging != "boolean") throw F(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEvent");
				if (i.isTagging) continue;
				I(e, i.parentGuid, "firefox-bookmarks-observer", "PlacesEvent.parentGuid");
				let t = x.get(i.parentGuid);
				if (t && n.add(t), i.type === "bookmark-moved") {
					let t = I(e, i.oldParentGuid, "firefox-bookmarks-observer", "PlacesBookmarkMoved.oldParentGuid"), r = x.get(t);
					r && n.add(r);
				}
				i.type === "bookmark-removed" && r.push(I(e, i.guid, "firefox-bookmarks-observer", "PlacesBookmarkRemoved.guid"));
			}
			let i = Array.from(n);
			i.length > k ? ce(Object.freeze([]), "all") : i.length > 0 && ce(Object.freeze(i), "parents");
			for (let e of r) te(e);
		} catch (e) {
			le(e);
		}
	}, de = b(() => {
		m && (m = !1, Reflect.apply(c.observers.removeListener, c.observers, [O, ue]));
	}), fe = Object.freeze({
		async children(t, n = {}) {
			let r;
			try {
				r = ae(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					parentId: t,
					status: "stale"
				});
				throw e;
			}
			if (!P(n) || Object.keys(n).some((e) => e !== "limit" && e !== "offset")) throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let i = n.limit ?? 32, a = n.offset ?? 0;
			if (!Number.isSafeInteger(i) || i < 1 || i > 32 || !Number.isSafeInteger(a) || a < 0 || a > j) throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let o = await se({ guid: r }, "firefox-bookmarks-query-parent");
			if (!o) return te(r), Object.freeze({
				parentId: t,
				status: "stale"
			});
			if (o.type !== c.bookmarks.TYPE_FOLDER) return Object.freeze({
				parentId: t,
				status: "stale"
			});
			let s = o.childCount, l = s === 0 ? 0 : Math.min(a, Math.floor((s - 1) / i) * i), u = Math.min(s, l + i), d = [];
			for (let e = l; e < u; e += 1) {
				let n = await se({
					index: e,
					parentGuid: r
				}, "firefox-bookmarks-query-child");
				if (!n || n.parentGuid !== r || n.index !== e) return Object.freeze({
					parentId: t,
					status: "stale"
				});
				d.push(oe(n));
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
			if (n !== "current" && n !== "new-tab") throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_DISPOSITION_INVALID", "firefox-bookmarks-open", "bookmarks.open.disposition");
			let r;
			try {
				r = ae(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					reason: "stale",
					status: "rejected"
				});
				throw e;
			}
			let i = await se({ guid: r }, "firefox-bookmarks-open-fetch");
			if (!i) return te(r), Object.freeze({
				reason: "stale",
				status: "rejected"
			});
			if (i.type !== c.bookmarks.TYPE_BOOKMARK) return Object.freeze({
				reason: "not-bookmark",
				status: "rejected"
			});
			let a = ie(i.url);
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
				throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_OPEN_FAILED", "firefox-bookmarks-open", "PlacesUIUtils.openNodeIn", t);
			}
			return Object.freeze({ status: "opened" });
		},
		async roots() {
			S();
			let t = c.bookmarks.userContentRoots, n = [];
			for (let r of t) {
				let t = await se({ guid: r }, "firefox-bookmarks-query-roots");
				if (!t || t.type !== c.bookmarks.TYPE_FOLDER) throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.userContentRoots");
				let i;
				try {
					i = Reflect.apply(c.bookmarks.getLocalizedTitle, c.bookmarks, [t]);
				} catch (t) {
					throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_FAILED", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle", t);
				}
				if (typeof i != "string") throw F(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle");
				n.push(oe(t, i));
			}
			return Object.freeze(n);
		},
		subscribe(t) {
			if (S(), typeof t != "function") throw F(e, "FENNEVIA_FIREFOX_BOOKMARKS_LISTENER_INVALID", "firefox-bookmarks-subscribe", "bookmarks.subscribe");
			return g.add(t), b(() => {
				g.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), Reflect.apply(c.observers.addListener, c.observers, [O, ue]), m = !0;
	} catch (t) {
		f = !0, d = null;
		let r;
		try {
			de();
		} catch (e) {
			r = e;
		}
		try {
			v.dispose();
		} catch (e) {
			r ??= e;
		}
		throw r !== void 0 && n(F(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", r)), t;
	}
	return Object.freeze({
		assertRequiredCapabilities: w,
		bookmarks: fe,
		dispose() {
			if (f) return !1;
			f = !0, d = null;
			let t;
			try {
				de();
			} catch (e) {
				t = e;
			}
			g.clear(), y.clear(), x.clear();
			try {
				v.dispose();
			} catch (e) {
				t ??= e;
			}
			if (t !== void 0) throw F(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", t);
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
var oe = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"application-menu",
	"settings",
	"customize",
	"native-toolbar"
]), se = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"application-menu"
]), ce = new Set(oe), le = new Set(se);
function ue(e) {
	return typeof e == "string" && ce.has(e);
}
function de(e) {
	return typeof e == "string" && le.has(e);
}
//#endregion
//#region src/firefox/browser-tools.ts
var fe = Object.freeze({ capture: !0 }), pe = Object.freeze([
	"appMenu-popup",
	"downloadsPanel",
	"identity-popup",
	"permission-popup",
	"protections-popup",
	"trustpanel-popup",
	"unified-extensions-panel"
]), me = new Set(pe), R = Object.freeze({
	"application-menu": Object.freeze(["appMenu-popup"]),
	downloads: Object.freeze(["downloadsPanel"]),
	extensions: Object.freeze(["unified-extensions-panel"]),
	protections: Object.freeze(["trustpanel-popup", "protections-popup"]),
	"site-information": Object.freeze(["trustpanel-popup", "identity-popup"]),
	"site-permissions": Object.freeze(["permission-popup"])
}), he = "bottomcenter topright", ge = Object.freeze({
	"application-menu": he,
	downloads: "after_start",
	extensions: "after_end",
	protections: "end_before",
	"site-information": "end_before",
	"site-permissions": "after_end"
}), _e = (e) => e === he, z = (e) => typeof e == "object" && !!e, B = (e) => typeof e == "function", ve = (e) => {
	let t = e.PanelMultiView;
	if (typeof t == "function") {
		let e = t;
		return B(e.openPopup) ? e : null;
	}
	return z(t) && B(t.openPopup) ? t : null;
}, ye = (e) => z(e) && B(e.addEventListener) && B(e.removeEventListener), be = (e) => z(e) && B(e.click) && B(e.focus), V = (e) => z(e) && B(e.hidePopup) && B(e.moveToAnchor) && B(e.openPopup), xe = (e) => typeof e == "number" && Number.isFinite(e) ? e : void 0, Se = (e) => {
	try {
		let t = Reflect.apply(e.getBoundingClientRect, e, []);
		if (!z(t)) return null;
		let n = xe(t.left) ?? xe(t.x), r = xe(t.top) ?? xe(t.y), i = xe(t.width), a = xe(t.height);
		return n === void 0 || r === void 0 || i === void 0 || a === void 0 ? null : Object.freeze({
			height: Math.max(1, Math.round(a)),
			width: Math.max(1, Math.round(i)),
			x: Math.round(n),
			y: Math.round(r)
		});
	} catch {
		return null;
	}
}, Ce = (e) => {
	let t = xe(e.mozInnerScreenX) ?? 0, n = xe(e.mozInnerScreenY) ?? 0;
	return Object.freeze({
		x: Math.round(t),
		y: Math.round(n)
	});
}, H = (e, t) => {
	let n = e.document;
	if (!(!z(n) || !B(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, we = (e) => z(e) ? e.panel : void 0, U = (e) => Object.freeze(e), Te = Object.freeze([
	U({
		isAvailable: (e) => be(e) && B(e.checkVisibility),
		name: "browser-tools.trust-anchor",
		read: (e) => H(e, "trust-icon-container"),
		symbol: "document.trust-icon-container.click.focus.checkVisibility"
	}),
	U({
		isAvailable: be,
		name: "browser-tools.identity-anchor",
		read: (e) => H(e, "identity-icon-box"),
		symbol: "document.identity-icon-box.click.focus"
	}),
	U({
		isAvailable: be,
		name: "browser-tools.protections-anchor",
		read: (e) => H(e, "tracking-protection-icon-container"),
		symbol: "document.tracking-protection-icon-container.click.focus"
	}),
	U({
		isAvailable: be,
		name: "browser-tools.permissions-anchor",
		read: (e) => H(e, "identity-permission-box"),
		symbol: "document.identity-permission-box.click.focus"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.unified-extensions",
		read: (e) => z(e.gUnifiedExtensions) ? e.gUnifiedExtensions.togglePanel : void 0,
		symbol: "window.gUnifiedExtensions.togglePanel"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.application-menu",
		read: (e) => z(e.PanelUI) ? e.PanelUI.show : void 0,
		symbol: "window.PanelUI.show"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.application-menu-ready",
		read: (e) => z(e.PanelUI) ? e.PanelUI.ensureReady : void 0,
		symbol: "window.PanelUI.ensureReady"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.settings",
		read: (e) => e.openPreferences,
		symbol: "window.openPreferences"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.customize",
		read: (e) => z(e.gCustomizeMode) ? e.gCustomizeMode.enter : void 0,
		symbol: "window.gCustomizeMode.enter"
	}),
	U({
		isAvailable: (e) => z(e) && B(e.focus),
		name: "browser-tools.native-toolbar-focus",
		read: (e) => H(e, "back-button"),
		symbol: "document.back-button.focus"
	}),
	U({
		isAvailable: be,
		name: "browser-tools.extensions-anchor",
		read: (e) => H(e, "unified-extensions-button"),
		symbol: "document.unified-extensions-button.click.focus"
	}),
	U({
		isAvailable: be,
		name: "browser-tools.application-menu-anchor",
		read: (e) => H(e, "PanelUI-menu-button"),
		symbol: "document.PanelUI-menu-button.click.focus"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.trust-panel",
		read: (e) => z(e.gTrustPanelHandler) ? e.gTrustPanelHandler.showPopup : void 0,
		symbol: "window.gTrustPanelHandler.showPopup"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.permission-set-anchor",
		read: (e) => z(e.gPermissionPanel) ? e.gPermissionPanel.setAnchor : void 0,
		symbol: "window.gPermissionPanel.setAnchor"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.permission-open-popup",
		read: (e) => z(e.gPermissionPanel) ? e.gPermissionPanel.openPopup : void 0,
		symbol: "window.gPermissionPanel.openPopup"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.downloads-initialize",
		read: (e) => z(e.DownloadsPanel) ? e.DownloadsPanel.initialize : void 0,
		symbol: "window.DownloadsPanel.initialize"
	}),
	U({
		isAvailable: V,
		name: "browser-tools.downloads-panel",
		read: (e) => {
			let t = H(e, "downloadsPanel");
			return V(t) ? t : we(e.DownloadsPanel);
		},
		symbol: "document.downloadsPanel.openPopup.moveToAnchor.hidePopup"
	}),
	U({
		isAvailable: V,
		name: "browser-tools.application-menu-panel",
		read: (e) => {
			let t = H(e, "appMenu-popup");
			return V(t) ? t : we(e.PanelUI);
		},
		symbol: "document.appMenu-popup.openPopup.moveToAnchor.hidePopup"
	}),
	U({
		isAvailable: V,
		name: "browser-tools.extensions-panel",
		read: (e) => {
			let t = H(e, "unified-extensions-panel");
			return V(t) ? t : we(e.gUnifiedExtensions);
		},
		symbol: "document.unified-extensions-panel.openPopup.moveToAnchor.hidePopup"
	}),
	U({
		isAvailable: ye,
		name: "browser-tools.document-events",
		read: (e) => e.document,
		symbol: "document.addEventListener.removeEventListener"
	})
]), Ee = (e) => Object.freeze(Te.map((t) => {
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
})), De = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, W = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: De(e),
	phase: n,
	symbol: r
}), Oe = (e) => {
	let t = (t) => e.some((e) => e.snapshot.name === t && e.snapshot.available);
	return Object.freeze({
		applicationMenu: t("browser-tools.application-menu"),
		customize: t("browser-tools.customize"),
		downloads: t("browser-tools.downloads-initialize") && t("browser-tools.downloads-panel"),
		extensions: t("browser-tools.unified-extensions"),
		nativeToolbar: t("browser-tools.native-toolbar-focus"),
		protections: t("browser-tools.trust-panel") && t("browser-tools.protections-anchor"),
		settings: t("browser-tools.settings"),
		siteInformation: t("browser-tools.trust-panel") && t("browser-tools.identity-anchor"),
		sitePermissions: t("browser-tools.permission-open-popup")
	});
}, ke = (e) => {
	let t = e.state;
	if (t === "open" || t === "showing") return !0;
	let n = e.getAttribute;
	if (!B(n)) return !1;
	let r = Reflect.apply(n, e, ["state"]);
	return r === "open" || r === "showing";
}, Ae = (e) => z(e) ? z(e.originalTarget) ? e.originalTarget : z(e.target) ? e.target : null : null;
function je({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, frame: r, requestNativeUiReveal: i, window: a }) {
	if (t.assertOwnsWindow(a), !z(a) || !z(r) || typeof r.contains != "function" || typeof i != "function" || typeof e != "function" || typeof n != "function") throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID", "firefox-browser-tools-create", "window");
	let o = (e) => Reflect.apply(r.contains, r, [e]) === !0, s = a, c = !1, l = 0, u = null, d = new Set(), f = [], p = new Set(), m = new Set(), h = () => {
		if (c || !s) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED", "firefox-browser-tools-access", "window");
		return s;
	}, g = () => {
		let e = Ee(h()), n = e.find((e) => !e.snapshot.available);
		if (n) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(e.map((e) => e.snapshot));
	}, v = () => {
		let e;
		try {
			e = i() === !0;
		} catch (e) {
			throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_FAILED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar", e);
		}
		if (!e) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar");
	}, y = async (e, n, r, i = []) => {
		let a = e[n];
		if (!B(a)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", r);
		try {
			await Reflect.apply(a, e, i);
		} catch (e) {
			throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", r, e);
		}
	}, b = (e) => {
		let n = h();
		if (!z(e) || !B(e.getBoundingClientRect) || e.ownerDocument !== n.document || o(e) !== !0) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID", "firefox-browser-tools-action", "browser-tools.host");
		return e;
	}, x = (e) => {
		let t = h();
		for (let n of e) {
			let e = H(t, n);
			if (V(e) && ke(e)) return e;
		}
		return null;
	}, S = (n) => {
		let r;
		try {
			r = e(n) === !0;
		} catch (e) {
			throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_FAILED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff", e);
		}
		if (!r) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_REJECTED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff");
	}, C = (e) => {
		try {
			n(e);
		} catch {}
	}, w = (e, n) => {
		try {
			Reflect.apply(e.hidePopup, e, []);
		} catch (e) {
			throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", n, e);
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
			throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
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
			throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
		}
	}, D = (e, t, n, r) => {
		if (_e(n)) {
			let n = Se(t), r = Ce(h()), i = e.moveTo;
			if (n && B(i)) try {
				let t = r.x + n.x, a = r.y + n.y + n.height, o = e.getOuterScreenRect;
				if (B(o)) {
					let i = Reflect.apply(o, e, []);
					if (z(i)) {
						let e = xe(i.width);
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
		for (let n of pe) {
			if (e.has(n)) continue;
			let r = H(t, n);
			V(r) && ke(r) && w(r, `document.${n}.hidePopup`);
		}
	}, k = (e, t) => {
		let n = e.closest;
		if (B(n)) try {
			if (Reflect.apply(n, e, ["[data-fennevia-address-popup]"]) != null) return "after_end";
			if (Reflect.apply(n, e, ["[data-fennevia-edge=\"left\"]"]) != null) return "end_before";
		} catch {}
		return ge[t];
	}, A = (e) => {
		let t = h();
		for (let n of R[e]) {
			let e = H(t, n);
			if (V(e)) return e;
		}
		return x(R[e]);
	}, j = (e) => {
		let n = A(e);
		if (!n) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", `document.${R[e][0]}.openPopup.moveToAnchor.hidePopup`);
		return n;
	}, M = async (e, n, r, i) => {
		let a = h(), o = ve(a), s = Se(n), c = Ce(a), l, u = () => ke(e), d = async (e) => {
			try {
				await e();
			} catch (e) {
				return l = e, u();
			}
			return u();
		}, f = () => {
			if (_e(r)) try {
				D(e, n, r, `${i}.moveTo`);
			} catch {}
		}, p = o && B(o.openPopup) ? o.openPopup : void 0, m = async (t, n) => !o || !p ? !1 : d(() => Reflect.apply(p, o, [
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
			return !s || !B(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
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
			return !s || !B(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
				c.x + s.x,
				c.y + s.y + s.height,
				!1
			]));
		}, C = (() => {
			let t = e.querySelector;
			if (!B(t)) return !1;
			try {
				return Reflect.apply(t, e, ["panelmultiview"]) != null;
			} catch {
				return !1;
			}
		})(), w = p && (C || _e(r)) ? _e(r) ? [
			async () => {
				let t = e.openPopupAtScreenRect, i = e.openPopup;
				if (!s || !p || !B(t) || !B(i)) return !1;
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
		] : _e(r) ? [
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
		throw _(l) ? l : W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", `${i}.openPopup`, l);
	}, N = async (e, t, n) => {
		let r = j(e), i = typeof r.id == "string" && r.id ? r.id : R[e][0];
		return ke(r) ? (E(r, t, n, `document.${i}.moveToAnchor`), r) : (await M(r, t, n, `document.${i}`), r);
	}, P = async () => {
		let e = h(), t = e.promiseDocumentFlushed;
		if (B(t)) try {
			await Reflect.apply(t, e, [() => void 0]);
			return;
		} catch {}
		await Promise.resolve();
	}, ee = (e, t = 800) => {
		let n = h(), r = H(n, e);
		return V(r) && ke(r) ? Promise.resolve(!0) : new Promise((r) => {
			let i = !1, a = (e) => {
				i || (i = !0, r(e));
			}, o = {
				panelId: e,
				resolve: a,
				timeoutHandle: void 0
			}, s = n.setTimeout;
			B(s) ? o.timeoutHandle = Reflect.apply(s, n, [() => {
				m.delete(o);
				let t = H(n, e);
				a(V(t) && ke(t));
			}, t]) : queueMicrotask(() => {
				m.delete(o);
				let t = H(n, e);
				a(V(t) && ke(t));
			}), m.add(o);
		});
	}, te = (e, t) => {
		let n = s;
		for (let r of Array.from(m)) if (r.panelId === e) {
			if (m.delete(r), n && B(n.clearTimeout)) try {
				Reflect.apply(n.clearTimeout, n, [r.timeoutHandle]);
			} catch {}
			r.resolve(t);
		}
	}, F = async (e, t) => {
		let n = b(t), r = R[e][0], i = k(n, e);
		O(new Set(R[e])), await P();
		for (let t of R[e]) S(t);
		return u = Object.freeze({
			host: n,
			panelId: r,
			position: i
		}), u;
	}, I = () => {
		let e = s;
		if (!e || !z(e.gPermissionPanel)) return;
		let t = e.gPermissionPanel.setAnchor;
		if (B(t)) try {
			Reflect.apply(t, e.gPermissionPanel, [null, "bottomleft topleft"]);
		} catch {}
	}, L = (e) => {
		let t = Object.freeze({
			open: e,
			type: "native-popup"
		});
		for (let e of Array.from(p)) e(t);
	}, ne = (e) => {
		if (c) return;
		let t = Ae(e), n = typeof t?.id == "string" ? t.id : typeof t?.getAttribute == "function" ? t.getAttribute("id") : void 0;
		if (typeof n != "string" || !me.has(n)) return;
		let r = z(e) ? e.type : void 0;
		if (r === "popupshown") {
			te(n, !0);
			for (let e of pe) e !== n && C(e);
			if (u && V(t)) try {
				D(t, u.host, u.position, `document.${n}.moveToAnchor`);
			} catch {}
			L(!0);
			return;
		}
		if (r === "popuphidden") {
			if (d.has(n)) return;
			u = null, n === "permission-popup" && I(), C(n), L(!1);
		}
	}, re = async (e, n) => {
		let r = h(), i = await F(e, n);
		for (let t of R[e]) d.add(t);
		try {
			switch (e) {
				case "site-information":
				case "protections": {
					if (!z(r.gTrustPanelHandler)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gTrustPanelHandler.showPopup");
					try {
						await y(r.gTrustPanelHandler, "showPopup", "window.gTrustPanelHandler.showPopup");
					} catch {}
					let n = x(R[e]);
					return n ? (E(n, i.host, i.position, `document.${n.id ?? i.panelId}.moveToAnchor`), !0) : (await N(e, i.host, i.position), !0);
				}
				case "site-permissions": {
					if (!z(r.gPermissionPanel)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					let n = r.gPermissionPanel.setAnchor;
					if (!B(n)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					try {
						Reflect.apply(n, r.gPermissionPanel, [i.host, i.position]);
					} catch (e) {
						throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor", e);
					}
					try {
						await y(r.gPermissionPanel, "openPopup", "window.gPermissionPanel.openPopup", [Object.freeze({})]);
					} catch {}
					let a = x(R[e]);
					return a ? (E(a, i.host, i.position, "document.permission-popup.moveToAnchor"), !0) : (await N(e, i.host, i.position), !0);
				}
				case "downloads":
					if (!z(r.DownloadsPanel)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.DownloadsPanel.initialize");
					return await y(r.DownloadsPanel, "initialize", "window.DownloadsPanel.initialize"), await N(e, i.host, i.position), !0;
				case "extensions": {
					let n = j(e);
					if (ke(n)) {
						w(n, "document.unified-extensions-panel.hidePopup"), u = null;
						for (let t of R[e]) C(t);
						return L(!1), !0;
					}
					if (!z(r.gUnifiedExtensions)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gUnifiedExtensions.togglePanel");
					let a = ve(r), o = a && B(a.openPopup) ? a.openPopup : void 0;
					if (a && o) try {
						a.openPopup = (e, ...t) => {
							if (!(z(e) && e.id === "unified-extensions-panel")) return Reflect.apply(o, a, [e, ...t]);
						};
					} catch {}
					try {
						await y(r.gUnifiedExtensions, "togglePanel", "window.gUnifiedExtensions.togglePanel");
					} catch {} finally {
						if (a && o) try {
							a.openPopup = o;
						} catch {}
					}
					return await N(e, i.host, i.position), !0;
				}
				case "application-menu": {
					let n = j(e);
					if (ke(n)) {
						w(n, "document.appMenu-popup.hidePopup"), u = null;
						for (let t of R[e]) C(t);
						return L(!1), !0;
					}
					if (!z(r.PanelUI)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.ensureReady");
					await y(r.PanelUI, "ensureReady", "window.PanelUI.ensureReady");
					let a = r.PanelUI._ensureShortcutsShown;
					if (B(a)) try {
						Reflect.apply(a, r.PanelUI, []);
					} catch {}
					try {
						await N(e, i.host, i.position);
					} catch {}
					let o = A(e);
					if (o && ke(o)) return !0;
					if (S("appMenu-popup"), !B(r.PanelUI.show)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.show");
					let s = ee("appMenu-popup");
					try {
						let e = Reflect.apply(r.PanelUI.show, r.PanelUI, []);
						Promise.resolve(e).catch(() => {});
					} catch (e) {
						throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.PanelUI.show", e);
					}
					await s;
					let c = A(e);
					return c && ke(c) ? (D(c, i.host, i.position, "document.appMenu-popup.moveTo"), !0) : (await N(e, i.host, i.position), !0);
				}
			}
			throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
		} finally {
			for (let t of R[e]) d.delete(t);
		}
	}, ie = Object.freeze({
		invoke: async (e, n) => {
			if (!ue(e)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			let r = h();
			l += 1;
			try {
				if (de(e)) return await re(e, n);
				switch (e) {
					case "settings": return await y(r, "openPreferences", "window.openPreferences"), !0;
					case "customize":
						if (!z(r.gCustomizeMode)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gCustomizeMode.enter");
						return await y(r.gCustomizeMode, "enter", "window.gCustomizeMode.enter"), !0;
					case "native-toolbar": {
						v();
						let e = H(r, "back-button");
						if (!z(e) || !B(e.focus)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "document.back-button.focus");
						try {
							Reflect.apply(e.focus, e, [Object.freeze({ preventScroll: !0 })]);
						} catch (e) {
							throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.back-button.focus", e);
						}
						return !0;
					}
				}
				throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			} finally {
				--l;
			}
		},
		snapshot() {
			return Oe(Ee(h()));
		},
		subscribe(e) {
			if (h(), typeof e != "function") throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_LISTENER_INVALID", "firefox-browser-tools-subscribe", "browser-tools.subscribe");
			p.add(e);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, p.delete(e), !0) : !1);
		}
	});
	try {
		t.assertRequiredCapabilities(), g();
		let e = h().document;
		if (!ye(e)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", "document.addEventListener.removeEventListener");
		f.push(t.subscribe(e, "popupshown", ne, fe), t.subscribe(e, "popuphidden", ne, fe));
	} catch (e) {
		c = !0, s = null;
		for (let e of f.reverse()) try {
			e();
		} catch {}
		throw e;
	}
	return Object.freeze({
		assertRequiredCapabilities: g,
		browserTools: ie,
		dispose() {
			if (c) return !1;
			c = !0;
			let e = s;
			u = null, p.clear();
			for (let e of Array.from(m)) m.delete(e), e.resolve(!1);
			if (e) {
				for (let t of pe) {
					let n = H(e, t);
					if (V(n) && ke(n)) try {
						Reflect.apply(n.hidePopup, n, []);
					} catch {}
					C(t);
				}
				I();
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
//#region src/app/toolbar-widgets-state.ts
var Me = Object.freeze([
	"built-in",
	"extension-action",
	"fennevia",
	"separator",
	"spacer",
	"spring"
]), Ne = Object.freeze([
	"top",
	"left",
	"right",
	"bottom"
]), Pe = Object.freeze(["show-bookmarks", "show-downloads"]), Fe = Object.freeze([
	"built-in",
	"extension-action",
	"fennevia",
	"special"
]), Ie = Object.freeze([
	"auto",
	"light",
	"dark"
]), Le = Object.freeze([
	"compact",
	"cozy",
	"comfortable"
]), Re = Object.freeze({
	blur: Object.freeze({
		max: 32,
		min: 0
	}),
	fontSize: Object.freeze({
		max: 14,
		min: 11
	}),
	motion: Object.freeze({
		max: 400,
		min: 0
	}),
	radius: Object.freeze({
		max: 16,
		min: 0
	}),
	saturation: Object.freeze({
		max: 180,
		min: 100
	}),
	shadow: Object.freeze({
		max: 100,
		min: 0
	}),
	surfaceOpacity: Object.freeze({
		max: 100,
		min: 50
	})
}), ze = /^#[0-9A-Fa-f]{6}$/u, Be = Object.freeze([
	"accent",
	"border",
	"chromeBackground",
	"surface",
	"text"
]), Ve = 48, He = /^[a-z][a-z0-9-]{0,63}$/u;
new Set(Me);
var Ue = new Set(Ne), We = new Set(Pe);
new Set(Fe);
var Ge = new Set(Ie), Ke = new Set(Le), qe = Object.freeze([
	"separator",
	"spacer",
	"spring"
]);
new Set(qe);
var Je = (e) => {
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
function Ye(e) {
	return typeof e == "string" && Ue.has(e);
}
function Xe(e) {
	return typeof e == "string" && We.has(e);
}
function Ze(e) {
	return typeof e == "string" && Ge.has(e);
}
function Qe(e) {
	return typeof e == "string" && Ke.has(e);
}
function $e() {
	return Object.freeze({
		accent: "",
		blur: 18,
		border: "",
		chromeBackground: "",
		density: "cozy",
		fontSize: 12,
		motion: 180,
		radius: 4,
		saturation: 145,
		shadow: 50,
		surface: "",
		surfaceOpacity: 94,
		text: "",
		theme: "auto"
	});
}
var et = (e, t) => typeof e == "number" && Number.isSafeInteger(e) && e >= t.min && e <= t.max, tt = new Set(Be);
function nt(e) {
	return typeof e == "string" && tt.has(e);
}
function rt(e) {
	return typeof e == "string" ? e === "" ? "" : ze.test(e) ? e.toLowerCase() : null : null;
}
var it = (e) => rt(e);
function at(e) {
	if (!e || typeof e != "object") throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = it(e.accent), n = it(e.border), r = it(e.chromeBackground), i = it(e.surface), a = it(e.text);
	if (t === null || n === null || r === null || i === null || a === null || !et(e.blur, Re.blur) || !Qe(e.density) || !et(e.fontSize, Re.fontSize) || !et(e.motion, Re.motion) || !et(e.radius, Re.radius) || !et(e.saturation, Re.saturation) || !et(e.shadow, Re.shadow) || !et(e.surfaceOpacity, Re.surfaceOpacity) || !Ze(e.theme)) throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	return Object.freeze({
		accent: t,
		blur: e.blur,
		border: n,
		chromeBackground: r,
		density: e.density,
		fontSize: e.fontSize,
		motion: e.motion,
		radius: e.radius,
		saturation: e.saturation,
		shadow: e.shadow,
		surface: i,
		surfaceOpacity: e.surfaceOpacity,
		text: a,
		theme: e.theme
	});
}
function ot(e) {
	if (!e || typeof e != "object") throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = Object.keys(e), n = {};
	for (let r of t) {
		if (nt(r)) {
			let t = it(e[r]);
			if (t === null) throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
			Object.assign(n, { [r]: t });
			continue;
		}
		Object.assign(n, { [r]: e[r] });
	}
	let r = at({
		...$e(),
		...n
	});
	if (t.length === 0 || t.some((e) => !(e in r)) || t.some((e) => n[e] !== r[e])) throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let i = {};
	for (let e of t) {
		let t = e;
		Object.assign(i, { [t]: r[t] });
	}
	return Object.freeze(i);
}
function st() {
	return Object.freeze({
		bottom: Object.freeze([]),
		left: Object.freeze([]),
		right: Object.freeze([]),
		top: Object.freeze([])
	});
}
function ct() {
	return Object.freeze({
		available: !1,
		canEdit: !1,
		layoutCustomized: !1,
		palette: Object.freeze([]),
		style: $e(),
		zones: st()
	});
}
var lt = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0 && e <= Ve, ut = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
function dt(e) {
	if (!e || typeof e != "object") throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	switch (e.type) {
		case "add":
			if (typeof e.token != "string" || !He.test(e.token) || !Ye(e.zone) || !lt(e.index) || !ut(e.revision)) throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				token: e.token,
				type: "add",
				zone: e.zone
			});
		case "move":
			if (!Ye(e.fromZone) || !Ye(e.toZone) || !lt(e.fromIndex) || !lt(e.toIndex) || !ut(e.revision)) throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				fromIndex: e.fromIndex,
				fromZone: e.fromZone,
				revision: e.revision,
				toIndex: e.toIndex,
				toZone: e.toZone,
				type: "move"
			});
		case "remove":
			if (!Ye(e.zone) || !lt(e.index) || !ut(e.revision)) throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				type: "remove",
				zone: e.zone
			});
		case "reset-layout":
			if (!ut(e.revision)) throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				revision: e.revision,
				type: "reset-layout"
			});
		case "set-style": return Object.freeze({
			style: ot(e.style),
			type: "set-style"
		});
		case "reset-style": return Object.freeze({ type: "reset-style" });
		default: throw Je("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	}
}
//#endregion
//#region src/firefox/customize-model.ts
var ft = Object.freeze([
	"separator",
	"spacer",
	"spring"
]), pt = new Set(ft), mt = Object.freeze({
	adoptedMaxEntries: 64,
	serializedMaxLength: 16384,
	widgetIdMaxLength: 128,
	zoneMaxEntries: 48
}), ht = /^[A-Za-z0-9_.-]{1,128}$/u;
function G(e) {
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
function gt(e) {
	return typeof e == "string" && pt.has(e);
}
function _t(e) {
	return typeof e == "string" && ht.test(e);
}
function vt(e) {
	if (!e || typeof e != "object") throw G("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	let t = e;
	if (t.type === "widget" && _t(t.id)) return Object.freeze({
		id: t.id,
		type: "widget"
	});
	if (t.type === "special" && gt(t.kind)) return Object.freeze({
		kind: t.kind,
		type: "special"
	});
	if (t.type === "fennevia" && Xe(t.id)) return Object.freeze({
		id: t.id,
		type: "fennevia"
	});
	throw G("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
}
function yt(e) {
	if (!e || typeof e != "object") throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e, n = [];
	for (let e of Ne) {
		let r = t[e];
		if (!Array.isArray(r) || r.length > mt.zoneMaxEntries) throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
		n.push([e, Object.freeze(r.map(vt))]);
	}
	return Object.freeze(Object.fromEntries(n));
}
function bt(e) {
	if (!e || typeof e != "object") throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e;
	if (t.version !== 1 || !Array.isArray(t.adopted) || t.adopted.length > mt.adoptedMaxEntries || t.adopted.some((e) => !_t(e))) throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	return Object.freeze({
		adopted: Object.freeze([...t.adopted]),
		version: 1,
		zones: yt(t.zones)
	});
}
function xt() {
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
function St(e, t = []) {
	return bt({
		adopted: t,
		version: 1,
		zones: {
			...xt().zones,
			...e
		}
	});
}
function Ct(e) {
	if (typeof e != "string" || e === "" || e.length > mt.serializedMaxLength) return null;
	try {
		return bt(JSON.parse(e));
	} catch {
		return null;
	}
}
function wt(e) {
	let t = JSON.stringify(bt(e));
	if (t.length > mt.serializedMaxLength) throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return t;
}
function Tt(e) {
	if (typeof e != "string" || e === "" || e.length > mt.serializedMaxLength) return null;
	try {
		let t = JSON.parse(e);
		return !t || typeof t != "object" || t.version !== 1 ? null : at({
			...$e(),
			...t,
			version: void 0
		});
	} catch {
		return null;
	}
}
function Et(e) {
	return JSON.stringify({
		...at(e),
		version: 1
	});
}
function Dt(e, t) {
	if (t.type === "special") return null;
	for (let n of Ne) {
		let r = e.zones[n];
		for (let [e, i] of r.entries()) if (i.type === t.type && i.id === t.id) return Object.freeze({
			index: e,
			zone: n
		});
	}
	return null;
}
var Ot = (e) => {
	if (!Ye(e)) throw G("FENNEVIA_CUSTOMIZE_MODEL_ZONE_INVALID");
	return e;
}, kt = (e, t) => {
	if (!Number.isSafeInteger(e) || e < 0) throw G("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return Math.min(e, t);
}, At = (e, t, n) => Object.freeze({
	adopted: e.adopted,
	version: 1,
	zones: Object.freeze({
		...e.zones,
		[t]: Object.freeze([...n])
	})
});
function jt(e, t, n, r) {
	let i = vt(t), a = Ot(n), o = Dt(e, i), s = e;
	o && (s = Mt(e, o.zone, o.index));
	let c = [...s.zones[a]];
	if (c.length >= mt.zoneMaxEntries) throw G("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return c.splice(kt(r, c.length), 0, i), At(s, a, c);
}
function Mt(e, t, n) {
	let r = Ot(t), i = [...e.zones[r]];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw G("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i.splice(n, 1), At(e, r, i);
}
function Nt(e, t, n) {
	let r = Ot(t), i = e.zones[r];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw G("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i[n];
}
function Pt(e, t, n, r, i) {
	let a = Nt(e, t, n), o = Mt(e, t, n), s = [...o.zones[Ot(r)]];
	if (s.length >= mt.zoneMaxEntries) throw G("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return s.splice(kt(i, s.length), 0, a), At(o, r, s);
}
function Ft(e, t) {
	if (!_t(t)) throw G("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	if (e.adopted.includes(t)) return e;
	if (e.adopted.length >= mt.adoptedMaxEntries) throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return Object.freeze({
		adopted: Object.freeze([...e.adopted, t]),
		version: 1,
		zones: e.zones
	});
}
function It(e, t) {
	return e.adopted.includes(t) ? Object.freeze({
		adopted: Object.freeze(e.adopted.filter((e) => e !== t)),
		version: 1,
		zones: e.zones
	}) : e;
}
function Lt(e, t) {
	return Dt(e, {
		id: t,
		type: "widget"
	}) !== null;
}
//#endregion
//#region src/firefox/downloads.ts
var Rt = "resource://gre/modules/Downloads.sys.mjs", zt = 3, Bt = (e) => typeof e == "object" && !!e, Vt = (e) => typeof e == "function", Ht = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Ut = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Ht(e),
	phase: n,
	symbol: r
}), Wt = (e) => typeof e == "number" && Number.isFinite(e) && Number.isSafeInteger(e) && e >= 0, Gt = (e, t) => {
	if (!Bt(t) || typeof t.stopped != "boolean" || typeof t.succeeded != "boolean" || typeof t.canceled != "boolean" || typeof t.hasPartialData != "boolean" || typeof t.hasProgress != "boolean" || !Number.isInteger(t.progress) || t.progress < 0 || t.progress > 100 || !Wt(t.currentBytes) || !Wt(t.totalBytes)) throw Ut(e, "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID", "firefox-downloads-event", "Download");
	return t;
}, Kt = (e) => e.stopped ? e.succeeded ? "succeeded" : e.error ? "failed" : e.canceled ? e.hasPartialData ? "paused" : "canceled" : "queued" : "active", qt = (e) => e === "succeeded" || e === "failed" || e === "canceled", Jt = (e) => Math.min(e, 999), Yt = () => Object.freeze({
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
function Xt({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !Bt(r) || typeof t != "function" || typeof n != "function") throw Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_OPTIONS_INVALID", "firefox-downloads-create", "ChromeUtils.importESModule");
	let i;
	try {
		i = t(Rt);
	} catch (t) {
		throw Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_MODULE_LOAD_FAILED", "firefox-downloads-module-load", "ChromeUtils.importESModule", t);
	}
	let a = Bt(i) ? i.Downloads : void 0, o = a, s = e.snapshot().windowKind === "private" ? "private" : "public", c = s === "private" ? o?.PRIVATE : o?.PUBLIC, l = Object.freeze([
		Object.freeze({
			isAvailable: Bt,
			name: "firefox.downloads",
			read: () => a,
			symbol: "Downloads"
		}),
		Object.freeze({
			isAvailable: Vt,
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
	]), u = r, d = null, f = !1, p = null, m = !0, h = 0, g = !1, v = !1, y = 0, x = 0, S = !1, C = Yt(), w = "", T = new Set(), E = e.createHandleRegistry("download"), D = new Map(), O = new WeakSet(), k = [], A = () => {
		if (f || !u) throw Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSED", "firefox-downloads-access", "window");
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
			available: Vt(d.addView),
			name: "firefox.downloads-list-add-view",
			requirement: "required",
			symbol: "DownloadList.addView"
		}) }), Object.freeze({ snapshot: Object.freeze({
			available: Vt(d.removeView),
			name: "firefox.downloads-list-remove-view",
			requirement: "required",
			symbol: "DownloadList.removeView"
		}) })), Object.freeze(e);
	}, M = () => {
		A();
		let t = j(), n = t.find((e) => !e.snapshot.available);
		if (n) throw Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, N = (t) => p || (p = _(t) ? t : Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_EVENT_FAILED", "firefox-downloads-event", "DownloadList.view", t), n(p), p), P = (e) => {
		let t = D.get(e);
		if (!t) return !1;
		D.delete(e);
		let n = k.indexOf(e);
		return n !== -1 && k.splice(n, 1), E.release(t.id), !0;
	}, ee = (e) => {
		let t = k.indexOf(e);
		for (t !== -1 && k.splice(t, 1), k.unshift(e); k.length > zt;) {
			let e = k.pop();
			e && P(e);
		}
	}, te = (t) => {
		let n = Gt(e, t), r = Kt(n);
		if (m && (O.add(n), qt(r))) return;
		let i = D.get(n);
		if (!(!i && qt(r) && O.has(n))) {
			if (i || (i = {
				currentBytes: 0,
				download: n,
				hasProgress: !1,
				id: E.register(n),
				order: ++x,
				progressPercent: null,
				state: r,
				totalBytes: 0
			}, D.set(n, i)), i.currentBytes = n.currentBytes, i.hasProgress = n.hasProgress, i.progressPercent = r === "succeeded" ? 100 : n.hasProgress ? n.progress : null, i.state = r, i.totalBytes = n.totalBytes, qt(r)) ee(n);
			else {
				let e = k.indexOf(n);
				e !== -1 && k.splice(e, 1);
			}
		}
	}, F = (e) => {
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
	}, I = () => {
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
		})), i = F(e.active), a = Object.freeze({
			active: e.active.length,
			canceled: e.canceled.length,
			failed: e.failed.length,
			paused: e.paused.length,
			queued: e.queued.length,
			succeeded: e.succeeded.length
		}), o = Object.values(a).some((e) => e > 999);
		return Object.freeze({
			activeCount: Jt(a.active),
			aggregatePercent: i.percent,
			canceledCount: Jt(a.canceled),
			countOverflow: o,
			failedCount: Jt(a.failed),
			items: Object.freeze(r),
			pausedCount: Jt(a.paused),
			phase: v ? "ready" : "loading",
			progressMode: i.mode,
			queuedCount: Jt(a.queued),
			revision: y + 1,
			succeededCount: Jt(a.succeeded),
			truncated: n.length > 6 || o
		});
	}, L = () => {
		if (f || p || m || h > 0) {
			g = !0;
			return;
		}
		g = !1;
		let t = I(), n = JSON.stringify({
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
				N(Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_SUBSCRIBER_FAILED", "firefox-downloads-notify", "downloads.subscribe", t));
				return;
			}
		}
	}, ne = Object.freeze({
		onDownloadAdded(e) {
			if (!(f || p)) try {
				te(e), L();
			} catch (e) {
				N(e);
			}
		},
		onDownloadBatchEnded() {
			f || p || (h > 0 && --h, h === 0 && g && L());
		},
		onDownloadBatchStarting() {
			!f && !p && (h += 1);
		},
		onDownloadChanged(e) {
			if (!(f || p)) try {
				te(e), L();
			} catch (e) {
				N(e);
			}
		},
		onDownloadRemoved(t) {
			if (!(f || p)) try {
				let n = Gt(e, t);
				P(n), L();
			} catch (e) {
				N(e);
			}
		}
	}), re = b(() => {
		!S || !d || (S = !1, Reflect.apply(d.removeView, d, [ne]));
	});
	e.assertRequiredCapabilities(), M();
	let ie = (async () => {
		try {
			let t = await Reflect.apply(o.getList, o, [c]);
			if (f) return !0;
			if (!Bt(t) || !Vt(t.addView) || !Vt(t.removeView)) throw Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", !Bt(t) || !Vt(t.addView) ? "DownloadList.addView" : "DownloadList.removeView");
			if (d = t, S = !0, Reflect.apply(d.addView, d, [ne]), f) return re(), !0;
			if (m = !1, h = 0, p) throw p;
			return v = !0, L(), !0;
		} catch (t) {
			if (f) return !0;
			throw p ?? N(_(t) ? t : Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_INITIALIZATION_FAILED", "firefox-downloads-initialize", "Downloads.getList", t));
		}
	})();
	ie.catch(() => void 0);
	let ae = Object.freeze({
		ready() {
			return A(), ie;
		},
		snapshot() {
			return A(), C;
		},
		subscribe(t) {
			if (A(), typeof t != "function") throw Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_LISTENER_INVALID", "firefox-downloads-subscribe", "downloads.subscribe");
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
				re();
			} catch (e) {
				t = e;
			}
			T.clear(), D.clear(), k.length = 0;
			try {
				E.dispose();
			} catch (e) {
				t ??= e;
			}
			if (d = null, t !== void 0) throw Ut(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSE_FAILED", "firefox-downloads-dispose", "DownloadList.removeView", t);
			return !0;
		},
		downloads: ae,
		ready() {
			return A(), ie;
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
var Zt = 2048, Qt = 4096, $t = (e) => {
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
function en(e) {
	if (!e || typeof e != "object") throw $t("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	let t = e;
	if (typeof t.altKey != "boolean" || typeof t.ctrlKey != "boolean" || typeof t.metaKey != "boolean" || typeof t.shiftKey != "boolean" || !Number.isInteger(t.button) || t.button < 0 || t.button > 2) throw $t("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
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
var tn = Object.freeze({
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
}), nn = Object.freeze(["TabSelect", "TabAttrModified"]), rn = new Set([
	"busy",
	"label",
	"selected"
]), an = "Browser:OpenLocation", on = "focusURLBar", sn = "data-fennevia-healthy", cn = Object.freeze({
	selectAll: !0,
	source: "ctrl-l",
	type: "address-popup-open"
}), ln = Object.freeze({ status: "accepted" }), un = Object.freeze({
	reason: "empty",
	status: "rejected"
}), dn = Object.freeze({
	reason: "too-long",
	status: "rejected"
}), fn = Object.freeze({
	reason: "unsafe-scheme",
	status: "rejected"
}), pn = /^\s*(?:data|javascript|vbscript)\s*:/iu, mn = new Set([
	"about:blank",
	"about:home",
	"about:newtab",
	"about:privatebrowsing"
]), hn = Object.freeze({
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
}), gn = (e) => `document.commands[${e.replaceAll(":", "-")}]`, K = (e) => typeof e == "object" && !!e, q = (e) => typeof e == "function", _n = (e) => K(e) && q(e.addEventListener) && q(e.removeEventListener), vn = (e) => e.gBrowser, yn = (e, t) => {
	let n = vn(e);
	return K(n) ? n[t] : void 0;
}, bn = (e, t) => {
	let n = yn(e, "selectedBrowser");
	return K(n) ? n[t] : void 0;
}, xn = (e, t) => {
	let n = e.BrowserCommands;
	return K(n) ? n[t] : void 0;
}, Sn = (e, t) => {
	let n = e.gURLBar;
	return K(n) ? n[t] : void 0;
}, Cn = (e, t) => e[t], wn = (e) => {
	let t = e.document;
	return K(t) ? t.documentElement : void 0;
}, Tn = (e, t) => {
	let n = e.document;
	if (!(!K(n) || !q(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, En = (e) => K(e) && q(e.hasAttribute), Dn = (e) => _n(e) && typeof e.value == "string" && q(e.getAttribute) && q(e.handleCommand), On = (e) => K(e) && q(e.getConnectionSecurityInformation), kn = (e) => K(e) && q(e.onContentBlockingEvent), An = (e) => K(e) && q(e.canHandle), jn = (e) => K(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", Mn = (e) => K(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), Nn = Object.freeze([
	Object.freeze({
		isAvailable: jn,
		name: "firefox.navigation-selected-browser",
		read: (e) => yn(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: Mn,
		name: "firefox.navigation-current-uri",
		read: (e) => bn(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-selected-browser-focus",
		read: (e) => bn(e, "focus"),
		symbol: "window.gBrowser.selectedBrowser.focus"
	}),
	Object.freeze({
		isAvailable: (e) => K(e) && q(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => yn(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: _n,
		name: "firefox.navigation-tab-events",
		read: (e) => yn(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: q,
		name: `firefox.navigation-${e}`,
		read: (e) => yn(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: (e) => typeof e == "string",
		name: "firefox.navigation-urlbar-value",
		read: (e) => Sn(e, "value"),
		symbol: "window.gURLBar.value"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-urlbar-submission",
		read: (e) => Sn(e, "handleCommand"),
		symbol: "window.gURLBar.handleCommand"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-urlbar-proxy-state",
		read: (e) => Sn(e, "getAttribute"),
		symbol: "window.gURLBar.getAttribute"
	}),
	Object.freeze({
		isAvailable: On,
		name: "firefox.navigation-connection-security",
		read: (e) => Cn(e, "gIdentityHandler"),
		symbol: "window.gIdentityHandler.getConnectionSecurityInformation"
	}),
	Object.freeze({
		isAvailable: kn,
		name: "firefox.navigation-tracking-protection",
		read: (e) => Cn(e, "gProtectionsHandler"),
		symbol: "window.gProtectionsHandler.onContentBlockingEvent"
	}),
	Object.freeze({
		isAvailable: An,
		name: "firefox.navigation-tracking-protection-availability",
		read: (e) => Cn(e, "ContentBlockingAllowList"),
		symbol: "window.ContentBlockingAllowList.canHandle"
	}),
	Object.freeze({
		isAvailable: (e) => En(e) && _n(e),
		name: "firefox.navigation-open-location-command",
		read: (e) => Tn(e, an),
		symbol: gn(an)
	}),
	Object.freeze({
		isAvailable: (e) => K(e) && q(e.hasAttribute),
		name: "firefox.navigation-shell-health-gate",
		read: wn,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Object.values(tn).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: En,
		name: `firefox.navigation-command-${t}`,
		read: (t) => Tn(t, e),
		symbol: gn(e)
	}), Object.freeze({
		isAvailable: q,
		name: `firefox.navigation-action-${t}`,
		read: (e) => xn(e, t),
		symbol: `window.BrowserCommands.${t}`
	})]),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-action-home",
		read: (e) => xn(e, "home"),
		symbol: "window.BrowserCommands.home"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-action-reloadOrDuplicate",
		read: (e) => xn(e, "reloadOrDuplicate"),
		symbol: "window.BrowserCommands.reloadOrDuplicate"
	})
]), Pn = (e) => Object.freeze(Nn.map((t) => {
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
})), Fn = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, J = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Fn(e),
	phase: n,
	symbol: r
}), In = (e, t) => e.addressValue === t.addressValue && e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.connectionSecurity === t.connectionSecurity && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title && e.trackingProtection === t.trackingProtection, Ln = (e) => {
	if (!K(e) || !K(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => rn.has(e));
};
function Rn({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !K(n) || typeof t != "function") throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID", "firefox-navigation-create", "window");
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
		if (i || !r) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSED", "firefox-navigation-access", "window.gBrowser.selectedBrowser");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, m = () => {
		let t = p().gBrowser;
		if (!K(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gBrowser");
		return t;
	}, h = () => {
		let t = m().selectedBrowser;
		if (!jn(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, g = () => {
		let t = m().selectedTab;
		if (!K(t) || !q(t.getAttribute)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, v = (t) => {
		let n = Tn(p(), t);
		if (!En(n)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", gn(t));
		return n;
	}, y = () => {
		let t = p().gURLBar;
		if (!Dn(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gURLBar.handleCommand");
		return t;
	}, x = () => {
		let t = p().gIdentityHandler;
		if (!On(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gIdentityHandler.getConnectionSecurityInformation");
		return t;
	}, S = () => {
		let t = p().gProtectionsHandler;
		if (!kn(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gProtectionsHandler.onContentBlockingEvent");
		return t;
	}, C = () => {
		let t = p().ContentBlockingAllowList;
		if (!An(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.ContentBlockingAllowList.canHandle");
		return t;
	}, w = () => {
		let t = Pn(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (e) => {
		let t = v(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, E = (t) => {
		let n = t.currentURI;
		if (!Mn(n)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, Zt);
	}, D = (e) => {
		if (mn.has(e)) return "";
		let t = y();
		return (Reflect.apply(t.getAttribute, t, ["pageproxystate"]) === "valid" ? t.value : e).slice(0, Qt);
	}, O = () => {
		let e = x(), t = Reflect.apply(e.getConnectionSecurityInformation, e, []);
		return typeof t == "string" ? hn[t] ?? "unavailable" : "unavailable";
	}, k = (e) => {
		let t = C();
		if (Reflect.apply(t.canHandle, t, [e]) !== !0) return "unavailable";
		let n = S();
		return typeof n.hasException != "boolean" || typeof n.anyBlocking != "boolean" || typeof n.anyDetected != "boolean" ? "unavailable" : n.hasException ? "exception" : n.anyBlocking ? "blocking" : n.anyDetected ? "detected" : "no-trackers-detected";
	}, A = () => {
		let e = h(), t = g(), n = E(e);
		return Object.freeze({
			addressValue: D(n),
			canGoBack: T(tn.back.id),
			canGoForward: T(tn.forward.id),
			connectionSecurity: O(),
			displayUri: n,
			loading: T(tn.stop.id),
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
			t(J(e, "FENNEVIA_FIREFOX_NAVIGATION_SUBSCRIBER_FAILED", "firefox-navigation-notify", "navigation.subscribe", n));
		}
	}, M = (e) => {
		let t = A();
		return In(s, t) && o > 0 ? !1 : (s = t, o += 1, e && j(), !0);
	}, N = (n, r) => {
		a = _(n) ? n : J(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, P = (e) => {
		if (!(i || a)) try {
			M(!0);
		} catch (t) {
			N(t, e);
		}
	}, ee = (e, t, n) => {
		if (!(i || a)) try {
			e === m().selectedBrowser && K(t) && t.isTopLevel === !0 && M(!0);
		} catch (e) {
			N(e, n);
		}
	}, te = Object.freeze({
		onLocationChange(e, t) {
			ee(e, t, "window.gBrowser.onLocationChange");
		},
		onStateChange(e, t) {
			ee(e, t, "window.gBrowser.onStateChange");
		},
		onSecurityChange(e, t) {
			ee(e, t, "window.gBrowser.onSecurityChange");
		},
		onContentBlockingEvent(e, t) {
			ee(e, t, "window.gBrowser.onContentBlockingEvent");
		}
	}), F = (e) => ({
		altKey: e.altKey,
		button: e.button,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		preventDefault() {},
		shiftKey: e.shiftKey
	}), I = (t, n) => {
		let r = p().BrowserCommands, i = K(r) ? r[t] : void 0;
		if (!q(i)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${t}`);
		try {
			return Reflect.apply(i, r, n === void 0 ? [] : [F(n)]), !0;
		} catch (n) {
			throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${t}`, n);
		}
	}, L = (e, t = !0, n) => {
		let r = tn[e];
		h();
		let i = v(r.id);
		return t && Reflect.apply(i.hasAttribute, i, ["disabled"]) ? !1 : I(r.method, n);
	}, ne = (t) => {
		if (typeof t != "string") return un;
		if (t.length > 4096) return dn;
		if (t.trim().length === 0) return un;
		if (pn.test(t)) return fn;
		h();
		let n = y();
		try {
			return n.value = t, Reflect.apply(n.handleCommand, n, []), ln;
		} catch (t) {
			throw J(e, "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED", "firefox-address-submit", "window.gURLBar.handleCommand", t);
		}
	}, re = () => {
		let e = wn(p());
		return K(e) && q(e.hasAttribute) && !!Reflect.apply(e.hasAttribute, e, [sn]);
	}, ie = (e) => {
		if (!K(e) || !K(e.sourceEvent)) return !1;
		let t = e.sourceEvent.target;
		return K(t) && t.id === on;
	}, ae = (e) => {
		if (!(i || a)) try {
			if (!re() || !ie(e) || f.size === 0) return;
			M(!0);
			let t = !1;
			for (let e of Array.from(f)) t = e(cn) === !0 || t;
			if (!t || !K(e)) return;
			q(e.preventDefault) && Reflect.apply(e.preventDefault, e, []), q(e.stopPropagation) && Reflect.apply(e.stopPropagation, e, []);
		} catch (e) {
			N(e, gn(an));
		}
	}, oe = Object.freeze({
		back: (e) => L("back", !0, e === void 0 ? void 0 : en(e)),
		focusContent() {
			let t = h(), n = t.focus;
			if (!q(n)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus");
			try {
				return Reflect.apply(n, t, []), !0;
			} catch (t) {
				throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus", t);
			}
		},
		forward: (e) => L("forward", !0, e === void 0 ? void 0 : en(e)),
		home(e) {
			return h(), I("home", e === void 0 ? void 0 : en(e));
		},
		newTab: () => L("newTab", !1),
		reload(e) {
			return e === void 0 ? L("reload") : (h(), I("reloadOrDuplicate", en(e)));
		},
		reloadOrStop() {
			let e = T(tn.stop.id) ? "stop" : "reload";
			return L(e), e;
		},
		snapshot() {
			return p(), s;
		},
		stop: () => L("stop"),
		submitAddress: ne,
		subscribe(t) {
			if (p(), typeof t != "function") throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_LISTENER_INVALID", "firefox-navigation-subscribe", "navigation.subscribe");
			return d.add(t), b(() => {
				d.delete(t);
			});
		},
		subscribeAddressPopupOpen(t) {
			if (p(), typeof t != "function") throw J(e, "FENNEVIA_FIREFOX_ADDRESS_POPUP_LISTENER_INVALID", "firefox-address-popup-subscribe", "navigation.subscribeAddressPopupOpen");
			return f.add(t), b(() => {
				f.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), M(!1);
		let t = m().tabContainer;
		for (let n of nn) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (K(e) && e.target !== m().selectedTab || !Ln(e))) return;
				M(!0);
			} catch (e) {
				N(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		u.push(e.subscribe(v(an), "command", ae));
		let n = m();
		Reflect.apply(n.addTabsProgressListener, n, [te]), l = !0;
		let r = p().MutationObserver;
		c = new r(() => {
			P("document.command.disabled");
		});
		for (let { id: e } of Object.values(tn)) c.observe(v(e), {
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
			let e = K(r.gBrowser) ? r.gBrowser : null;
			e && q(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [te]);
		} catch (e) {
			a ??= e;
		}
		l = !1;
		for (let e of u.reverse()) try {
			e();
		} catch (e) {
			a ??= e;
		}
		throw r = null, a !== void 0 && t(J(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", a)), n;
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
				let e = K(r.gBrowser) ? r.gBrowser : null;
				if (!e || !q(e.removeTabsProgressListener)) throw TypeError("FENNEVIA_FIREFOX_NAVIGATION_PROGRESS_DISPOSER_INVALID");
				Reflect.apply(e.removeTabsProgressListener, e, [te]);
			} catch (e) {
				t ??= e;
			}
			l = !1;
			for (let e of u.reverse()) try {
				e();
			} catch (e) {
				t ??= e;
			}
			if (u.length = 0, d.clear(), f.clear(), r = null, t !== void 0) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", t);
			return !0;
		},
		navigation: oe,
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
var zn = Object.freeze([
	"playing",
	"muted",
	"blocked"
]), Bn = Object.freeze([
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
new Set(zn);
var Vn = new Set(Bn);
function Hn(e) {
	return typeof e == "string" && Vn.has(e);
}
//#endregion
//#region src/firefox/tabs.ts
var Un = Object.freeze([
	"TabOpen",
	"TabClose",
	"TabSelect",
	"TabMove",
	"TabPinned",
	"TabUnpinned",
	"TabAttrModified"
]), Wn = new Set([
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
]), Gn = 262144, Kn = 1e5, qn = "resource://gre/modules/ContextualIdentityService.sys.mjs", Jn = /[\s"'<>\\]/u, Yn = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, Xn = Object.freeze({
	toolbar: "gray",
	turquoise: "cyan"
}), Zn = (e) => typeof e == "object" && !!e || typeof e == "function", Y = (e) => typeof e == "object" && !!e, Qn = (e) => typeof e == "function", $n = (e) => e.gBrowser, er = (e, t) => {
	let n = $n(e);
	return Y(n) ? n[t] : void 0;
}, tr = (e, t) => {
	let n = e.document;
	if (!(!Y(n) || !Qn(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, nr = (e) => Y(e) && Qn(e.openPopup) && Qn(e.moveTo) && Qn(e.addEventListener) && Qn(e.removeEventListener), rr = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => er(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: Zn,
		name: "firefox.selected-tab",
		read: (e) => er(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab"
	}),
	...[
		["add-tab", "addTrustedTab"],
		["remove-tab", "removeTab"],
		["pin-tab", "pinTab"],
		["unpin-tab", "unpinTab"],
		["move-tab", "moveTabTo"]
	].map(([e, t]) => Object.freeze({
		isAvailable: Qn,
		name: `firefox.${e}`,
		read: (e) => er(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: (e) => typeof e == "string" && e.length > 0 && e.length <= 2048,
		name: "firefox.new-tab-url",
		read: (e) => e.BROWSER_NEW_TAB_URL,
		symbol: "window.BROWSER_NEW_TAB_URL"
	}),
	Object.freeze({
		isAvailable: nr,
		name: "firefox.tab-context-menu",
		read: (e) => tr(e, "tabContextMenu"),
		symbol: "document.tabContextMenu.openPopup.moveTo"
	})
]), ir = (e) => Object.freeze(rr.map((t) => {
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
})), ar = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, X = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: ar(e),
	phase: n,
	symbol: r
}), or = (e, t) => {
	if (!Y(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw X(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, sr = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !Jn.test(e) || e.length <= Gn && Yn.test(e))) return e;
}, cr = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl && e.audio === r.audio && e.attention === r.attention && e.pictureInPicture === r.pictureInPicture && e.container?.color === r.container?.color && e.container?.label === r.container?.label;
}), lr = (e) => {
	if (!Y(e) || !Y(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Wn.has(e));
}, ur = (e) => {
	if (typeof e != "string" || e.length === 0) return;
	let t = Xn[e] ?? e;
	return Hn(t) ? t : void 0;
}, dr = (e, t) => !Y(e) || e.target === void 0 || e.target === t || Y(e.target) && e.target.id === "tabContextMenu";
function fr({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !Y(r) || typeof n != "function") throw X(e, "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID", "firefox-tabs-create", "window");
	let i = r, a = !1, o = null, s = 0, c = Object.freeze([]), l = new Set(), u = new Set(), d = [], f = e.createHandleRegistry("tab"), p = null, m = null;
	if (typeof t == "function") try {
		let e = t(qn), n = Y(e) ? e.ContextualIdentityService : void 0;
		Y(n) && Qn(n.getPublicIdentityFromId) && (p = n);
	} catch {
		p = null;
	}
	let h = () => {
		if (a || !i) throw X(e, "FENNEVIA_FIREFOX_TABS_DISPOSED", "firefox-tabs-access", "window.gBrowser.openTabs");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, g = () => {
		let t = h().gBrowser;
		if (!Y(t)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "window.gBrowser");
		return t;
	}, v = () => {
		let t = ir(h()), n = t.find((e) => !e.snapshot.available);
		if (n) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, y = () => {
		let t = g().openTabs;
		if (!Array.isArray(t)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = t.map((t) => or(e, t));
		if (new Set(n).size !== n.length) throw X(e, "FENNEVIA_FIREFOX_TAB_ORDER_INVALID", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
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
		if (!Y(n)) return;
		let r = ur(n.color);
		if (!r) return;
		let i = "";
		if (typeof n.name == "string" && (i = n.name), i.trim().length === 0 && Qn(p.getUserContextLabel)) try {
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
		let n = String(x(e, "label") ?? "").slice(0, 256), r = sr(x(e, "image")), i = C(e), a = w(e);
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
			n(X(e, "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED", "firefox-tabs-notify", "tabs.subscribe", t));
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
		return !cr(c, i) && (c = i, s += 1, e && D(), !0);
	}, k = (t, r) => {
		o = _(t) ? t : X(e, "FENNEVIA_FIREFOX_TABS_EVENT_FAILED", "firefox-tabs-event", `window.gBrowser.tabContainer.${r}`, t), n(o);
	}, A = (t) => {
		h();
		let n = f.resolve(t);
		if (!y().includes(n)) throw f.release(t), l.delete(t), X(e, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-action", "tab.opaque-id");
		return n;
	}, j = (t, n) => {
		let r = g(), i = r[t];
		if (typeof i != "function") throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", `window.gBrowser.${t}`);
		return Reflect.apply(i, r, n);
	}, M = (t) => {
		if (t === void 0) return Object.freeze({ selected: !0 });
		if (!Y(t) || Object.keys(t).some((e) => e !== "selected") || t.selected !== void 0 && typeof t.selected != "boolean") throw X(e, "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID", "firefox-tabs-action", "tabs.open.options");
		return Object.freeze({ selected: t.selected ?? !0 });
	}, N = (t) => {
		if (!Y(t) || Object.keys(t).some((e) => e !== "screenX" && e !== "screenY") || typeof t.screenX != "number" || typeof t.screenY != "number" || !Number.isFinite(t.screenX) || !Number.isFinite(t.screenY) || Math.abs(t.screenX) > Kn || Math.abs(t.screenY) > Kn) throw X(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POINT_INVALID", "firefox-tabs-action", "tabs.openContextMenu.point");
		return Object.freeze({
			screenX: t.screenX,
			screenY: t.screenY
		});
	}, P = () => {
		if (h(), !m || !nr(m)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
		return m;
	}, ee = Object.freeze({
		close(e) {
			let t = A(e);
			j("removeTab", [t, {
				animate: !0,
				isUserTriggered: !0
			}]), O(!0);
		},
		move(t, n) {
			let r = A(t);
			if (!Number.isSafeInteger(n) || n < 0 || n > 1e4) throw X(e, "FENNEVIA_FIREFOX_TAB_MOVE_INDEX_INVALID", "firefox-tabs-action", "tabs.move.index");
			j("moveTabTo", [r, {
				isUserTriggered: !0,
				tabIndex: n
			}]), O(!0);
		},
		open(t) {
			let n = M(t), r = h().BROWSER_NEW_TAB_URL;
			if (typeof r != "string" || r.length === 0) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.BROWSER_NEW_TAB_URL");
			let i = or(e, j("addTrustedTab", [r, { inBackground: !n.selected }]));
			if (!y().includes(i)) throw X(e, "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED", "firefox-tabs-action", "window.gBrowser.addTrustedTab");
			let a = f.register(i);
			if (O(!0), n.selected && g().selectedTab !== i) throw X(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			return a;
		},
		openContextMenu(t, r) {
			let i = A(t), a = N(r), o = P(), s = o.openPopup, c = o.moveTo;
			if (!Qn(s) || !Qn(c)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
			try {
				Reflect.apply(s, o, [
					i,
					"after_start",
					0,
					0,
					!0
				]);
			} catch (t) {
				throw X(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_REJECTED", "firefox-tabs-action", "document.tabContextMenu.openPopup", t);
			}
			try {
				Reflect.apply(c, o, [a.screenX, a.screenY]);
			} catch (t) {
				n(X(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POSITION_FAILED", "firefox-tabs-action", "document.tabContextMenu.moveTo", t));
			}
		},
		pin(t) {
			let n = A(t);
			if (!S(n, "pinned")) {
				if (j("pinTab", [n]), !S(n, "pinned")) throw X(e, "FENNEVIA_FIREFOX_TAB_PIN_REJECTED", "firefox-tabs-action", "window.gBrowser.pinTab");
				O(!0);
			}
		},
		select(t) {
			let n = A(t), r = g();
			if (r.selectedTab !== n) {
				if (!Reflect.set(r, "selectedTab", n) || r.selectedTab !== n) throw X(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
				O(!0);
			}
		},
		snapshot() {
			return h(), c;
		},
		subscribe(t) {
			if (h(), typeof t != "function") throw X(e, "FENNEVIA_FIREFOX_TABS_LISTENER_INVALID", "firefox-tabs-subscribe", "tabs.subscribe");
			return u.add(t), b(() => {
				u.delete(t);
			});
		},
		toggleMute(t) {
			let n = A(t), r = n.toggleMuteAudio;
			if (!Qn(r)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "MozTabbrowserTab.toggleMuteAudio");
			Reflect.apply(r, n, []), O(!0);
		},
		unpin(t) {
			let n = A(t);
			if (S(n, "pinned")) {
				if (j("unpinTab", [n]), S(n, "pinned")) throw X(e, "FENNEVIA_FIREFOX_TAB_UNPIN_REJECTED", "firefox-tabs-action", "window.gBrowser.unpinTab");
				O(!0);
			}
		}
	});
	try {
		e.assertRequiredCapabilities(), v(), O(!1);
		let t = g().tabContainer;
		for (let n of Un) d.push(e.subscribe(t, n, (e) => {
			if (!(a || o)) try {
				if (n === "TabAttrModified" && !lr(e)) return;
				O(!0);
			} catch (e) {
				k(e, n);
			}
		}));
		let n = tr(h(), "tabContextMenu");
		if (!nr(n)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "document.tabContextMenu.openPopup.moveTo");
		m = n, d.push(e.subscribe(n, "popupshown", (e) => {
			a || o || !dr(e, n) || E(Object.freeze({
				open: !0,
				type: "context-menu"
			}));
		})), d.push(e.subscribe(n, "popuphidden", (e) => {
			a || !dr(e, n) || E(Object.freeze({
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
		throw r !== void 0 && n(X(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", r)), t;
	}
	return Object.freeze({
		assertRequiredCapabilities: v,
		dispose() {
			if (a) return !1;
			a = !0, i = null;
			let t, n = m?.hidePopup;
			if (m && Qn(n)) try {
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
			if (t !== void 0) throw X(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", t);
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
		tabs: ee
	});
}
//#endregion
//#region src/firefox/toolbar-widgets.ts
var pr = "nav-bar", mr = "unified-extensions-area", hr = "fennevia.customize.layout", gr = "fennevia.customize.style", _r = "fennevia.customize.", vr = 16384, yr = 256, br = "customizationui-widget-panel", xr = 800, Sr = "after_start", Cr = 200, wr = 300, Tr = 8, Er = 512, Dr = Object.freeze({ capture: !0 }), Or = /^rgba?\([0-9\s.,%]{1,48}\)$/u, kr = /url\(\s*"((?:[^"\\]|\\.){1,512})"\s*\)/u, Ar = /url\(\s*'((?:[^'\\]|\\.){1,512})'\s*\)/u, jr = /url\(\s*((?:[^"')\\]|\\.){1,512})\s*\)/u, Mr = "moz-extension://", Nr = "chrome://", Pr = "resource://", Fr = "-browser-action", Ir = /["'\\<>\s]/u, Lr = /#([A-Za-z_][\w-]*)/gu, Rr = 128, zr = 48, Br = /^(?:branding|browser|toolkit|preview)\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.ftl$/u, Vr = /^(?:[A-Za-z][\w-]*\.)?(?:label|tooltiptext\d*)$/u, Hr = /%[0-9$]*[Ssd]/u, Ur = Object.freeze([
	"back-button",
	"forward-button",
	"stop-reload-button",
	"home-button",
	"urlbar-container",
	"search-container",
	"downloads-button",
	"unified-extensions-button",
	"PanelUI-menu-button",
	"personal-bookmarks",
	"menubar-items",
	"tabbrowser-tabs"
]), Wr = new Set(Ur), Gr = new Map([
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
]), Kr = Object.freeze([
	"browser/browser.ftl",
	"browser/sidebar.ftl",
	"browser/appmenu.ftl",
	"browser/screenshots.ftl"
]), qr = new Map([
	["bookmarks-menu-button", "bookmarks-menu-button"],
	["characterencoding-button", "repair-text-encoding-button"],
	["email-link-button", "toolbar-button-email-link"],
	["firefox-view-button", "toolbar-button-firefox-view-2"],
	["fullscreen-button", "appmenuitem-fullscreen"],
	["import-button", "browser-import-button2"],
	["library-button", "navbar-library"],
	["logins-button", "toolbar-button-logins"],
	["new-window-button", "appmenuitem-new-window"],
	["open-file-button", "toolbar-button-open-file"],
	["preferences-button", "toolbar-settings-button"],
	["print-button", "navbar-print"],
	["privatebrowsing-button", "toolbar-button-new-private-window"],
	["reset-pbm-toolbar-button", "reset-pbm-toolbar-button2"],
	["save-page-button", "toolbar-button-save-page"],
	["screenshot-button", "screenshot-toolbar-button"],
	["send-tab-button", "toolbar-button-send-tab"],
	["share-tab-button", "toolbar-button-share-tab"],
	["sidebar-button", "show-sidebars"],
	["sync-button", "toolbar-button-synced-tabs"],
	["tab-groups-button", "toolbar-button-tab-groups"]
]), Jr = new Map([
	["bookmarks-menu-button", "chrome://browser/skin/bookmark-star-on-tray.svg"],
	["characterencoding-button", "chrome://browser/skin/characterEncoding.svg"],
	["developer-button", "chrome://global/skin/icons/developer.svg"],
	["email-link-button", "chrome://browser/skin/mail.svg"],
	["find-button", "chrome://global/skin/icons/search-glass.svg"],
	["firefox-view-button", "chrome://browser/skin/firefox-view.svg"],
	["fullscreen-button", "chrome://browser/skin/fullscreen.svg"],
	["ipprotection-button", "chrome://browser/content/logos/ipprotection-states.svg#off"],
	["library-button", "chrome://browser/skin/library.svg"],
	["logins-button", "chrome://browser/skin/login.svg"],
	["new-window-button", "chrome://browser/skin/window.svg"],
	["open-file-button", "chrome://browser/skin/open.svg"],
	["panic-button", "chrome://browser/skin/forget.svg"],
	["preferences-button", "chrome://global/skin/icons/settings.svg"],
	["print-button", "chrome://global/skin/icons/print.svg"],
	["privatebrowsing-button", "chrome://browser/skin/privateBrowsing.svg"],
	["reset-pbm-toolbar-button", "chrome://browser/skin/flame.svg"],
	["save-page-button", "chrome://browser/skin/save.svg"],
	["screenshot-button", "chrome://browser/skin/screenshot.svg"],
	["send-tab-button", "chrome://browser/skin/send-tab-20.svg"],
	["share-tab-button", "chrome://browser/skin/share.svg"],
	["sidebar-button", "chrome://browser/skin/sidebar-collapsed.svg"],
	["sync-button", "chrome://browser/skin/synced-tabs.svg"],
	["tab-groups-button", "chrome://browser/skin/tabbrowser/tab-groups.svg"]
]), Yr = new Map([["show-bookmarks", Object.freeze({
	icon: "bookmark",
	label: "Show bookmarks panel",
	tooltip: "Reveal the Fennevia bookmarks panel"
})], ["show-downloads", Object.freeze({
	icon: "download",
	label: "Open Firefox downloads",
	tooltip: "Open the Firefox downloads panel"
})]]), Z = (e) => typeof e == "object" && !!e, Q = (e) => typeof e == "function", Xr = (e) => Z(e) && Q(e.getAttribute), Zr = (e) => Z(e) && Q(e.hidePopup) && Q(e.moveToAnchor), Qr = (e, t) => typeof e == "string" ? e.slice(0, t) : "", $r = (e) => {
	let t = e.trim();
	return Or.test(t) ? t : "";
}, ei = (e) => {
	let t = e.CustomizableUI;
	return !Z(t) || !Q(t.getWidgetIdsInArea) || !Q(t.getWidget) || !Q(t.addListener) || !Q(t.removeListener) ? null : t;
}, ti = (e) => {
	let t = e.Services;
	if (!Z(t)) return null;
	let n = t.prefs;
	return !Z(n) || !Q(n.addObserver) || !Q(n.clearUserPref) || !Q(n.getStringPref) || !Q(n.removeObserver) || !Q(n.setStringPref) ? null : n;
}, ni = (e, t) => {
	try {
		let n = Reflect.apply(e.getStringPref, e, [t, ""]);
		return typeof n == "string" && n.length <= vr ? n : "";
	} catch {
		return "";
	}
}, ri = (e) => {
	try {
		let t = e.AREA_ADDONS;
		return typeof t == "string" && t !== "" ? t : mr;
	} catch {
		return mr;
	}
}, ii = (e, t) => {
	if (Q(e.isWebExtensionWidget)) try {
		return Reflect.apply(e.isWebExtensionWidget, e, [t]) === !0;
	} catch {}
	return t.endsWith(Fr);
}, ai = (e) => {
	let t = e.PanelUI;
	return !Z(t) || !Q(t.showSubView) ? null : t.showSubView;
}, oi = Object.freeze([
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.customizable-ui",
		read: (e) => ei(e),
		requirement: "optional",
		symbol: "window.CustomizableUI.getWidgetIdsInArea.getWidget.addListener.removeListener"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.panel-ui-sub-view",
		read: (e) => ai(e),
		requirement: "optional",
		symbol: "window.PanelUI.showSubView"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.prefs",
		read: (e) => ti(e),
		requirement: "optional",
		symbol: "window.Services.prefs.getStringPref.setStringPref.clearUserPref.addObserver.removeObserver"
	}),
	Object.freeze({
		isAvailable: (e) => Z(e) && Q(e.addEventListener) && Q(e.removeEventListener) && Q(e.getElementById),
		name: "toolbar-widgets.document-events",
		read: (e) => e.document,
		requirement: "required",
		symbol: "document.addEventListener.removeEventListener.getElementById"
	})
]), si = (e) => Object.freeze(oi.map((t) => {
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
})), ci = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, $ = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: ci(e),
	phase: n,
	symbol: r
}), li = (e) => {
	if (e.startsWith("customizableui-special-")) {
		let t = /^customizableui-special-(spring|spacer|separator)/u.exec(e);
		return t ? t[1] : null;
	}
	return e === "spring" || e === "spacer" || e === "separator" ? e : e === "vertical-spacer" ? "spacer" : null;
}, ui = (e, t) => {
	if (!e) return "";
	try {
		let n = e[t];
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, di = (e, t) => {
	let n = e.document;
	if (!(!Z(n) || !Q(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, fi = (e, t) => {
	if (Q(e.querySelector)) try {
		return Reflect.apply(e.querySelector, e, [t]);
	} catch {
		return;
	}
}, pi = (e, t) => {
	try {
		let n = Reflect.apply(e.getAttribute, e, [t]);
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, mi = (e) => {
	if (e === "" || e === "none") return "";
	let t = kr.exec(e);
	if (t) return t[1].replace(/\\(.)/gu, "$1");
	let n = Ar.exec(e);
	if (n) return n[1].replace(/\\(.)/gu, "$1");
	let r = jr.exec(e);
	return r ? r[1].replace(/\\(.)/gu, "$1") : "";
}, hi = (e, t) => e === "" || e.length > Er || Ir.test(e) ? !1 : t === "extension" ? e.startsWith(Mr) : e.startsWith(Nr) || e.startsWith(Pr), gi = (e) => {
	if (Xr(e)) return e;
	if (Array.isArray(e)) {
		let t = e[0];
		return Xr(t) ? t : null;
	}
	if (!Z(e)) return null;
	let t = e[0];
	if (Xr(t)) return t;
	if (Q(e.item)) try {
		let t = Reflect.apply(e.item, e, [0]);
		return Xr(t) ? t : null;
	} catch {
		return null;
	}
	return null;
}, _i = (e) => {
	if (!Z(e)) return "";
	try {
		let t = e.listStyleImage;
		if (typeof t == "string" && t !== "") {
			let e = mi(t);
			if (e) return e;
		}
	} catch {}
	if (Q(e.getPropertyValue)) try {
		let t = Reflect.apply(e.getPropertyValue, e, ["list-style-image"]);
		if (typeof t == "string") return mi(t);
	} catch {
		return "";
	}
	return "";
}, vi = (e) => {
	try {
		let t = e.style, n = _i(t);
		if (n) return n;
	} catch {}
	return "";
}, yi = (e) => {
	if (typeof e != "string" || e === "") return [];
	let t = [];
	Lr.lastIndex = 0;
	for (let n of e.matchAll(Lr)) {
		let e = n[1];
		e && t.push(e);
	}
	return t;
}, bi = (e, t, n = []) => {
	if (!Z(e)) return;
	let r;
	try {
		r = e.selectorText;
	} catch {
		r = void 0;
	}
	let i = yi(r), a = i.length > 0 ? i : n, o = vi(e);
	if (o && hi(o, "builtin")) for (let e of a) t.set(e, o);
	let s;
	try {
		s = e.cssRules;
	} catch {
		s = void 0;
	}
	if (Z(s) && typeof s.length == "number") {
		let e = s.length;
		for (let n = 0; n < e; n += 1) bi(s[n], t, a);
	}
}, xi = (e, t) => {
	if (Array.isArray(e) || Z(e)) return e[t];
}, Si = (e, t) => {
	if (Array.isArray(e)) {
		for (let n of e) if (Z(n) && n.name === t && typeof n.value == "string") return n.value;
		return "";
	}
	if (!Z(e)) return "";
	if (typeof e.length == "number" && e.length > 0) {
		let n = e.length;
		for (let r = 0; r < n; r += 1) {
			let n = e[r];
			if (Z(n) && n.name === t && typeof n.value == "string") return n.value;
		}
	}
	let n = e[t];
	return typeof n == "string" ? n : "";
}, Ci = (e, t) => {
	let n = xi(e, 0);
	if (!Z(n)) return "";
	let r = Si(n.attributes, "label") || Si(n.attributes, "tooltiptext"), i = typeof n.value == "string" ? n.value : "", a = r || i;
	return !a || a === t ? "" : Qr(a, Cr);
}, wi = (e, t) => {
	if (Q(e.formatMessagesSync)) try {
		let n = Ci(Reflect.apply(e.formatMessagesSync, e, [[{ id: t }]]), t);
		if (n) return n;
	} catch {}
	if (!Q(e.formatValueSync)) return "";
	try {
		let n = Reflect.apply(e.formatValueSync, e, [t]);
		return typeof n != "string" || n === "" || n === t ? "" : Qr(n, Cr);
	} catch {
		return "";
	}
}, Ti = (e) => e.length > 0 && e.length <= Rr && !e.includes("..") && Br.test(e), Ei = (e) => {
	let t = [], n = new Set(), r = (e) => {
		let r = e.trim();
		n.has(r) || !Ti(r) || t.length >= zr || (n.add(r), t.push(r));
	};
	for (let e of Kr) r(e);
	if (!Q(e.querySelectorAll)) return t;
	try {
		let t = Reflect.apply(e.querySelectorAll, e, ["link[rel=\"localization\"]"]), n = Array.isArray(t) || Z(t) && typeof t.length == "number" ? t.length : 0;
		for (let e = 0; e < n; e += 1) {
			let n = xi(t, e);
			Xr(n) && r(pi(n, "href"));
		}
	} catch {}
	return t;
}, Di = (e, t = "") => t && (e === t || e.startsWith(`${t}.`)) ? !0 : Vr.test(e), Oi = (e, t, n = "") => !e || Di(e, n) || Hr.test(e) ? "" : Qr(e, t), ki = (e) => e.isConnected === !0, Ai = (e) => {
	let t = fi(e, ".unified-extensions-item-action-button");
	return Xr(t) ? t : null;
}, ji = (e) => {
	let t = "", n = e.style;
	if (Z(n) && Q(n.getPropertyValue)) try {
		let e = Reflect.apply(n.getPropertyValue, n, ["--webextension-toolbar-image"]);
		typeof e == "string" && (t = e);
	} catch {
		t = "";
	}
	t ||= pi(e, "style");
	let r = mi(t);
	return hi(r, "extension") ? r : "";
}, Mi = (e) => {
	let t = Qr(pi(e, "badge"), Tr), n = "", r = "", i = pi(e, "badgeStyle"), a = /background-color:\s*([^;]{1,64})/u.exec(i);
	a && (n = $r(a[1]));
	let o = /(?:^|;)\s*color:\s*([^;]{1,64})/u.exec(i);
	return o && (r = $r(o[1])), Object.freeze({
		background: n,
		text: t,
		textColor: r
	});
}, Ni = (e) => {
	let t = fi(e, ".unified-extensions-item-name");
	if (Z(t) && typeof t.textContent == "string") {
		let e = t.textContent.trim();
		if (e) return Qr(e, Cr);
	}
	return "";
}, Pi = (e) => e.disabled === !0 || pi(e, "disabled") === "true";
function Fi({ boundary: e, frame: t, window: n }) {
	if (e.assertOwnsWindow(n), !Z(n) || !Z(t) || typeof t.contains != "function") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_OPTIONS_INVALID", "firefox-toolbar-widgets-create", "window");
	let r = (e) => Reflect.apply(t.contains, t, [e]) === !0, i = n, a = !1, o = 0, s = 0, c = !1, l = !1, u = !1, d = "", f = ct(), p = null, m = $e(), h = 0, g = new Map(), v = new Map(), y = null, b = null, x, S = null, C = "", w = null, T = "", E = null, D = new Set(), O = [], k = new Set(), A = new Set(), j = e.createHandleRegistry("toolbar-widget"), M = () => {
		if (a || !i) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_DISPOSED", "firefox-toolbar-widgets-access", "window");
		return i;
	}, N = () => {
		let t = si(M()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, P = (t) => {
		let n = M();
		if (!Z(t) || !Q(t.getBoundingClientRect) || t.ownerDocument !== n.document || r(t) !== !0) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HOST_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.host");
		return t;
	}, ee = e.snapshot().windowKind === "private", te = (e, t) => {
		try {
			let n = Reflect.apply(e.getWidget, e, [t]);
			return Z(n) ? n : null;
		} catch {
			return null;
		}
	}, F = (e) => {
		let t = i;
		if (!t) return null;
		let n = t.gNavToolbox;
		if (!Z(n)) return null;
		let r = n.palette;
		if (!Z(r) || !Q(r.getElementsByAttribute)) return null;
		try {
			return gi(Reflect.apply(r.getElementsByAttribute, r, ["id", e]));
		} catch {
			return null;
		}
	}, I = (e) => {
		let t = i;
		if (!t) return null;
		let n = di(t, e);
		return Xr(n) ? n : F(e);
	}, L = () => {
		if (x !== void 0) return x;
		x = null;
		let e = i;
		if (!e || !Q(e.Localization)) return null;
		let t = e.document, n = Z(t) ? Ei(t) : [...Kr];
		try {
			let t = Reflect.construct(e.Localization, [n, !0]);
			return !Z(t) || !Q(t.formatMessagesSync) && !Q(t.formatValueSync) ? null : (x = t, t);
		} catch {
			return null;
		}
	}, ne = (e) => {
		if (!e) return "";
		let t = L();
		if (t) {
			let n = wi(t, e);
			if (n) return n;
		}
		let n = i;
		if (!n) return "";
		let r = n.document;
		if (!Z(r)) return "";
		let a = r.l10n;
		return Z(a) ? wi(a, e) : "";
	}, re = (e, t, n) => {
		if (!Q(e.getLocalizedProperty)) return "";
		try {
			let r = Reflect.apply(e.getLocalizedProperty, e, [t, n]);
			return typeof r != "string" || r === "" ? "" : Oi(r, Cr, t);
		} catch {
			return "";
		}
	}, ie = (e, t, n, r, i) => {
		let a = r ? Oi(pi(r, "label") || ui(r, "label"), Cr, t) : "", o = r ? Oi(pi(r, "title") || ui(r, "title"), Cr, t) : "", s = r ? Oi(pi(r, "tooltiptext") || ui(r, "tooltiptext"), Cr, t) : "", c = Oi(ui(n, "label"), Cr, t), l = Oi(ui(n, "tooltiptext"), Cr, t), u = r ? ne(pi(r, "data-l10n-id")) : "", d = ne(qr.get(t) ?? "");
		return a || o || c || u || re(e, t, "label") || d || s || l || re(e, t, "tooltiptext") || (i ? "Extension" : "Toolbar item");
	}, ae = (e, t, n, r) => {
		let i = n ? Oi(pi(n, "tooltiptext") || ui(n, "tooltiptext"), wr, e) : "", a = n ? Oi(pi(n, "title") || ui(n, "title"), wr, e) : "", o = Oi(ui(t, "tooltiptext"), wr, e);
		return i || a || o || r;
	}, oe = () => {
		let e = new Map(), t = i;
		if (!t) return e;
		let n = t.document;
		if (!Z(n)) return e;
		let r = n.styleSheets;
		if (!Z(r) || typeof r.length != "number") return e;
		let a = r.length;
		for (let t = 0; t < a; t += 1) {
			let n;
			try {
				n = r[t];
			} catch {
				continue;
			}
			if (!Z(n)) continue;
			let i;
			try {
				i = n.cssRules;
			} catch {
				continue;
			}
			if (!Z(i) || typeof i.length != "number") continue;
			let a = i.length;
			for (let t = 0; t < a; t += 1) bi(i[t], e);
		}
		return e;
	}, se = (e) => (b ||= oe(), b.get(e) ?? ""), ce = (e) => {
		let t = i;
		if (!t || !Q(t.getComputedStyle)) return "";
		let n = [e], r = fi(e, "toolbarbutton");
		Xr(r) && n.unshift(r);
		for (let e of n) try {
			let n = _i(Reflect.apply(t.getComputedStyle, t, [e]));
			if (hi(n, "builtin")) return n;
		} catch {}
		return "";
	}, le = (e, t) => {
		if (t) {
			let e = ce(t);
			if (e) return e;
		}
		let n = se(e);
		if (n) return n;
		let r = Jr.get(e) ?? "";
		return hi(r, "builtin") ? r : "";
	}, ue = (e) => Object.freeze({
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
	}), de = (e) => {
		let t = Yr.get(e);
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
	}, fe = (e, t) => {
		let n = te(e, t), r = n?.webExtension === !0 || ii(e, t), i = I(t), a = ie(e, t, n, i, r), o = "";
		if (r && i) {
			let e = Ai(i);
			o = e ? ji(e) : "";
		} else r || (o = le(t, i));
		return Object.freeze({
			badgeBackground: "",
			badgeText: "",
			badgeTextColor: "",
			disabled: !0,
			fenneviaAction: "",
			handle: "",
			icon: r ? "extension" : Gr.get(t) ?? "generic",
			iconUrl: o,
			kind: r ? "extension-action" : "built-in",
			label: a,
			missing: !0,
			tooltip: ae(t, n, i, a)
		});
	}, pe = (e, t) => {
		let n = di(M(), t);
		if (!Xr(n) || !ki(n)) return Object.freeze({
			node: null,
			widget: fe(e, t)
		});
		let r = te(e, t), i = r?.webExtension === !0 || ii(e, t), a = j.register(n);
		if (i) {
			let i = Ai(n), o = i ? Mi(i) : Object.freeze({
				background: "",
				text: "",
				textColor: ""
			}), s = Ni(n) || ie(e, t, r, n, !0);
			return Object.freeze({
				node: n,
				widget: Object.freeze({
					badgeBackground: o.background,
					badgeText: o.text,
					badgeTextColor: o.textColor,
					disabled: Pi(i || n),
					fenneviaAction: "",
					handle: a,
					icon: "extension",
					iconUrl: i ? ji(i) : "",
					kind: "extension-action",
					label: s,
					missing: !1,
					tooltip: ae(t, r, n, s)
				})
			});
		}
		let o = ie(e, t, r, n, !1);
		return Object.freeze({
			node: n,
			widget: Object.freeze({
				badgeBackground: "",
				badgeText: "",
				badgeTextColor: "",
				disabled: Pi(n),
				fenneviaAction: "",
				handle: a,
				icon: Gr.get(t) ?? "generic",
				iconUrl: le(t, n),
				kind: "built-in",
				label: o,
				missing: !1,
				tooltip: ae(t, r, n, o)
			})
		});
	}, me = (e, t) => t.type === "special" ? Object.freeze({
		node: null,
		widget: ue(t.kind)
	}) : t.type === "fennevia" ? Object.freeze({
		node: null,
		widget: de(t.id)
	}) : pe(e, t.id), R = (e) => {
		let t;
		try {
			t = Reflect.apply(e.getWidgetIdsInArea, e, [pr]);
		} catch {
			t = null;
		}
		let n = [];
		if (Array.isArray(t)) for (let e of t) {
			if (typeof e != "string" || Wr.has(e)) continue;
			let t = li(e);
			if (t) {
				n.push(Object.freeze({
					kind: t,
					type: "special"
				}));
				continue;
			}
			_t(e) && n.push(Object.freeze({
				id: e,
				type: "widget"
			}));
		}
		return St({ top: n });
	}, he = (e) => {
		let t = g.get(e);
		if (t) return t;
		let n = `palette-${++h}`;
		return g.set(e, n), n;
	}, ge = (e) => {
		let t;
		try {
			t = e.areas;
		} catch {
			t = void 0;
		}
		let n = Array.isArray(t) ? t : [pr], r = [], i = new Set();
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
	}, _e = (e) => {
		if (!Q(e.getUnusedWidgets)) return [];
		let t = i?.gNavToolbox, n = Z(t) ? t.palette : void 0;
		if (!Z(n)) return [];
		try {
			let t = Reflect.apply(e.getUnusedWidgets, e, [n]);
			if (!Array.isArray(t)) return [];
			let r = [];
			for (let e of t) Z(e) && typeof e.id == "string" && r.push(e.id);
			return r;
		} catch {
			return [];
		}
	}, z = (e, t) => {
		if (Wr.has(t) || li(t) !== null || !_t(t)) return null;
		let n = te(e, t);
		if (ee && n?.showInPrivateBrowsing === !1) return null;
		let r = n?.webExtension === !0 || ii(e, t), i = I(t), a = Xr(i) && ki(i) ? i : null, o, s;
		if (r) {
			let r = a ? Ai(a) : i ? Ai(i) : null;
			s = r ? ji(r) : "", o = (a ? Ni(a) : "") || ie(e, t, n, i, !0);
		} else o = ie(e, t, n, i, !1), s = le(t, i);
		let c = he(`w:${t}`);
		return v.set(c, Object.freeze({
			id: t,
			type: "widget"
		})), Object.freeze({
			icon: r ? "extension" : Gr.get(t) ?? "generic",
			iconUrl: s,
			kind: r ? "extension-action" : "built-in",
			label: o,
			token: c
		});
	}, B = (e, t) => {
		v.clear();
		let n = [], r = new Set(), i = new Set();
		for (let e of Ne) for (let n of t.zones[e]) n.type === "widget" ? r.add(n.id) : n.type === "fennevia" && i.add(n.id);
		for (let e of Pe) {
			if (i.has(e)) continue;
			let t = Yr.get(e), r = he(`f:${e}`);
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
		let a = [...ge(e), ..._e(e)], o = new Set();
		for (let t of a) {
			if (o.has(t) || r.has(t) || n.length >= yr) continue;
			o.add(t);
			let i = z(e, t);
			i && n.push(i);
		}
		for (let [e, t] of [
			["separator", "Separator"],
			["spacer", "Space"],
			["spring", "Flexible space"]
		]) {
			let r = he(`s:${e}`);
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
	}, ve = (e) => {
		if (Z(y) && Q(y.disconnect)) try {
			Reflect.apply(y.disconnect, y, []);
		} catch {}
		y = null;
		let t = i;
		if (!t) return;
		let n = t.MutationObserver;
		if (Q(n)) try {
			let t = Reflect.construct(n, [() => {
				V();
			}]);
			if (!Q(t.observe)) return;
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
	}, ye = () => {
		let e = M(), t = ei(e);
		if (!t) return v.clear(), ve([]), Object.freeze({
			serialized: "unavailable",
			snapshot: ct()
		});
		let n = p ?? R(t), r = [], i = [], a = new Set();
		for (let e of Ne) {
			let o = [];
			for (let r of n.zones[e]) {
				let e = me(t, r);
				o.push(e.widget), i.push(e.node), e.widget.handle !== "" && a.add(e.widget.handle);
			}
			r.push([e, Object.freeze(o)]);
		}
		for (let e of D) if (!a.has(e)) try {
			j.release(e);
		} catch {}
		D.clear();
		for (let e of a) D.add(e);
		ve(i);
		let o = ti(e), s = Object.freeze({
			available: !0,
			canEdit: o !== null,
			layoutCustomized: p !== null,
			palette: B(t, n),
			style: at(m),
			zones: Object.freeze(Object.fromEntries(r))
		});
		return Object.freeze({
			serialized: JSON.stringify(s),
			snapshot: s
		});
	}, be = () => {
		if (a) return;
		let e = ye();
		if (e.serialized === d) return;
		d = e.serialized, f = e.snapshot, s += 1;
		let t = Object.freeze({
			revision: s,
			snapshot: f,
			type: "snapshot"
		});
		for (let e of Array.from(k)) e(t);
	}, V = () => {
		if (a || c) return;
		c = !0;
		let e = () => {
			c = !1, !a && be();
		}, t = i, n = t?.setTimeout;
		if (t && Q(n)) {
			Reflect.apply(n, t, [e, 0]);
			return;
		}
		queueMicrotask(e);
	}, xe = Object.freeze({
		onAreaReset: () => V(),
		onCustomizeEnd: () => V(),
		onWidgetAdded: () => V(),
		onWidgetCreated: () => V(),
		onWidgetDestroyed: () => V(),
		onWidgetInstanceRemoved: () => V(),
		onWidgetMoved: () => V(),
		onWidgetOverflow: () => V(),
		onWidgetRemoved: () => V(),
		onWidgetReset: () => V(),
		onWidgetUndoMove: () => V(),
		onWidgetUnderflow: () => V()
	}), Se = () => {
		if (!l) return;
		l = !1;
		let e = i;
		if (!e) return;
		let t = ei(e);
		if (t) try {
			Reflect.apply(t.removeListener, t, [xe]);
		} catch {}
	}, Ce = () => {
		let e = i;
		if (!e) return;
		let t = ti(e);
		if (!t) {
			p = null, m = $e();
			return;
		}
		p = Ct(ni(t, hr)), m = Tt(ni(t, gr)) ?? $e();
	}, H = Object.freeze({ observe: () => {
		a || (Ce(), V());
	} }), we = () => {
		if (!u) return;
		u = !1;
		let e = i, t = e ? ti(e) : null;
		if (t) try {
			Reflect.apply(t.removeObserver, t, [_r, H]);
		} catch {}
	}, U = () => {
		let t = ti(M());
		if (!t) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.Services.prefs");
		return t;
	}, Te = (e) => {
		let t = U();
		Reflect.apply(t.setStringPref, t, [hr, wt(e)]), p = e;
	}, Ee = (e) => {
		let t = U();
		Reflect.apply(t.setStringPref, t, [gr, Et(e)]), m = e;
	}, De = (t, n, r) => {
		let i = "";
		if (Q(t.getPlacementOfWidget)) try {
			let e = Reflect.apply(t.getPlacementOfWidget, t, [r]);
			Z(e) && typeof e.area == "string" && (i = e.area);
		} catch {
			i = "";
		}
		if (i !== "" && i !== ri(t)) return n;
		if (!Q(t.addWidgetToArea)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI.addWidgetToArea");
		return Reflect.apply(t.addWidgetToArea, t, [r, pr]), Ft(n, r);
	}, W = (e, t, n) => {
		if (!t.adopted.includes(n)) return t;
		if (ii(e, n)) {
			if (Q(e.addWidgetToArea)) try {
				Reflect.apply(e.addWidgetToArea, e, [n, ri(e)]);
			} catch {}
		} else if (Q(e.removeWidgetFromArea)) try {
			Reflect.apply(e.removeWidgetFromArea, e, [n]);
		} catch {}
		return It(t, n);
	}, Oe = () => {
		let t = ei(M());
		if (!t) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI");
		return t;
	}, ke = async (t) => {
		M();
		let n;
		try {
			n = dt(t);
		} catch (t) {
			throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
		}
		o += 1;
		try {
			if (n.type === "set-style") return Ee(at({
				...m,
				...n.style
			})), be(), !0;
			if (n.type === "reset-style") {
				let e = U();
				try {
					Reflect.apply(e.clearUserPref, e, [gr]);
				} catch {}
				return m = $e(), be(), !0;
			}
			let t = Oe();
			if (U(), n.revision !== s) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_STALE", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit-revision");
			let r = p ?? R(t);
			try {
				switch (n.type) {
					case "add": {
						let i = v.get(n.token);
						if (!i) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.palette-token");
						let a = r;
						i.type === "widget" && (a = De(t, a, i.id)), a = jt(a, i, n.zone, n.index), Te(a);
						break;
					}
					case "move":
						Te(Pt(r, n.fromZone, n.fromIndex, n.toZone, n.toIndex));
						break;
					case "remove": {
						let e = Nt(r, n.zone, n.index), i = Mt(r, n.zone, n.index);
						e.type === "widget" && !Lt(i, e.id) && (i = W(t, i, e.id)), Te(i);
						break;
					}
					case "reset-layout": {
						let e = r;
						for (let n of [...r.adopted]) e = W(t, e, n);
						let n = U();
						try {
							Reflect.apply(n.clearUserPref, n, [hr]);
						} catch {}
						p = null;
						break;
					}
				}
			} catch (t) {
				throw _(t) ? t : $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_FAILED", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
			}
			return be(), !0;
		} finally {
			--o;
		}
	}, Ae = (e) => {
		let t = Object.freeze({
			open: e,
			type: "widget-popup"
		});
		for (let e of Array.from(A)) e(t);
	}, je = (e) => {
		let t = w;
		if (!t) return;
		w = null;
		let n = i;
		if (n && Q(n.clearTimeout)) try {
			Reflect.apply(n.clearTimeout, n, [t.timeoutHandle]);
		} catch {}
		t.resolve(e);
	}, Me = (e) => {
		let t = E;
		if (!t) return;
		E = null;
		let n = i;
		if (t.timeoutHandle !== void 0 && n && Q(n.clearTimeout)) try {
			Reflect.apply(n.clearTimeout, n, [t.timeoutHandle]);
		} catch {}
		t.resolve(e);
	}, Fe = (e, t) => {
		S = e, C = t, Ae(!0);
	}, Ie = () => {
		S && (S = null, C = "", Ae(!1));
	}, Le = (e) => Z(e) ? Z(e.originalTarget) ? e.originalTarget : Z(e.target) ? e.target : null : null, Re = (e, t) => {
		if (t === e) return !0;
		if (!Q(e.contains)) return !1;
		try {
			return Reflect.apply(e.contains, e, [t]) === !0;
		} catch {
			return !1;
		}
	}, ze = (e) => {
		if (a) return;
		let t = Le(e);
		if (!t || !Zr(t)) return;
		let n = typeof t.id == "string" ? t.id : "";
		if (w && n === br) {
			let e = T;
			je(!0), T = "", Fe(t, e);
			return;
		}
		if (E) {
			let e = t.anchorNode;
			if (Re(E.node, e)) {
				let { handle: e, host: n } = E;
				try {
					Reflect.apply(t.moveToAnchor, t, [
						n,
						Sr,
						0,
						0
					]);
				} catch {}
				Fe(t, e), Me(!0);
			}
		}
	}, Be = (e) => {
		if (a) return;
		let t = Le(e);
		if (!t) return;
		if (S && t === S) {
			Ie();
			return;
		}
		let n = typeof t.id == "string" ? t.id : "";
		w && n === br && (je(!1), T = "");
	}, Ve = (e) => {
		let t = M();
		return je(!1), new Promise((n) => {
			let r = {
				resolve: n,
				timeoutHandle: void 0
			};
			w = r, T = e;
			let i = () => {
				w === r && (w = null, T = "", n(!1));
			}, a = t.setTimeout;
			Q(a) ? r.timeoutHandle = Reflect.apply(a, t, [i, xr]) : queueMicrotask(i);
		});
	}, He = (e, t, n) => {
		let r = M();
		return Me(!1), new Promise((i) => {
			let a = {
				handle: e,
				host: t,
				node: n,
				resolve: i,
				timeoutHandle: void 0
			};
			E = a;
			let o = () => {
				E === a && (E = null, i(!1));
			}, s = r.setTimeout;
			Q(s) ? a.timeoutHandle = Reflect.apply(s, r, [o, xr]) : queueMicrotask(o);
		});
	}, Ue = () => {
		let e = S;
		if (e) try {
			Reflect.apply(e.hidePopup, e, []);
		} catch {
			Ie();
		}
	}, We = (t) => {
		if (Q(t.doCommand)) try {
			Reflect.apply(t.doCommand, t, []);
			return;
		} catch {}
		let n = M().CustomEvent;
		if (!Q(n) || !Q(t.dispatchEvent)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command");
		let r = Reflect.construct(n, ["command", Object.freeze({
			bubbles: !0,
			cancelable: !0
		})]);
		Reflect.apply(t.dispatchEvent, t, [r]);
	}, Ge = (e) => {
		let t = ei(M()), n = typeof e.id == "string" ? e.id : "";
		if (!t || !n) return "";
		try {
			let e = Reflect.apply(t.getWidget, t, [n]);
			if (Z(e) && typeof e.viewId == "string") return e.viewId;
		} catch {
			return "";
		}
		return "";
	}, Ke = Object.freeze({
		edit: ke,
		invoke: async (t, n) => {
			if (typeof t != "string" || t === "") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.handle");
			let r = P(n), i = j.resolve(t);
			if (!ki(i)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE", "firefox-toolbar-widgets-action", "toolbar-widgets.native-node");
			o += 1;
			try {
				if (S && C === t) return Ue(), !0;
				Ue();
				let n = M(), a = Ge(i), o = ai(n);
				if (a && o) {
					try {
						r.open === !0 && (r.open = !1);
					} catch {}
					let i = Ve(t);
					try {
						let e = Reflect.apply(o, n.PanelUI, [a, r]);
						Promise.resolve(e).catch(() => {});
					} catch (t) {
						throw je(!1), T = "", $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.PanelUI.showSubView", t);
					}
					return await i;
				}
				let s = He(t, r, i);
				try {
					We(i);
				} catch (t) {
					throw Me(!1), _(t) ? t : $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command", t);
				}
				return await s;
			} finally {
				--o;
			}
		},
		snapshot() {
			M();
			let e = ye();
			return d = e.serialized, f = e.snapshot, f;
		},
		subscribe(t) {
			if (M(), typeof t != "function") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			k.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, k.delete(t), !0) : !1);
		},
		subscribePopup(t) {
			if (M(), typeof t != "function") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			A.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, A.delete(t), !0) : !1);
		}
	});
	try {
		N();
		let t = M().document;
		O.push(e.subscribe(t, "popupshown", ze, Dr), e.subscribe(t, "popuphidden", Be, Dr));
		let n = ei(M());
		n && (Reflect.apply(n.addListener, n, [xe]), l = !0);
		let r = ti(M());
		r && (Reflect.apply(r.addObserver, r, [_r, H]), u = !0), Ce();
		let i = ye();
		d = i.serialized, f = i.snapshot;
	} catch (e) {
		a = !0, we(), x = null, i = null;
		for (let e of O.reverse()) try {
			e();
		} catch {}
		throw O.length = 0, e;
	}
	return Object.freeze({
		assertRequiredCapabilities: N,
		dispose() {
			if (a) return !1;
			let e = S;
			if (a = !0, je(!1), T = "", Me(!1), Se(), we(), Z(y) && Q(y.disconnect)) try {
				Reflect.apply(y.disconnect, y, []);
			} catch {}
			if (y = null, S = null, C = "", e) try {
				Reflect.apply(e.hidePopup, e, []);
			} catch {}
			k.clear(), A.clear(), D.clear(), g.clear(), v.clear(), b = null, x = null, j.dispose(), i = null;
			for (let e of O.reverse()) try {
				e();
			} catch {}
			return O.length = 0, !0;
		},
		refresh() {
			return !a && (be(), !0);
		},
		snapshot() {
			return Object.freeze({
				disposed: a,
				pendingActionCount: o,
				revision: s,
				widgetCount: Ne.reduce((e, t) => e + f.zones[t].length, 0)
			});
		},
		toolbarWidgets: Ke
	});
}
//#endregion
//#region src/app/urlbar-coverage-state.ts
var Ii = Object.freeze([
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
]), Li = Object.freeze([
	"location",
	"media",
	"serial",
	"xr"
]), Ri = Object.freeze([
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
new Set(Ii), new Set(Li), new Set(Ri);
//#endregion
//#region src/firefox/urlbar-coverage.ts
var zi = Object.freeze([
	"blocked-permissions-container",
	"identity-permission-box",
	"page-action-buttons"
]), Bi = Object.freeze({
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
}), Vi = Object.freeze([
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
]), Hi = Object.freeze([
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
]), Ui = new Set([
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
]), Wi = (e) => typeof e == "object" && !!e, Gi = (e) => typeof e == "function", Ki = (e) => Wi(e) && Gi(e.getAttribute) && Gi(e.hasAttribute), qi = (e) => Wi(e) && Gi(e.getElementById), Ji = (e) => qi(e.document) ? e.document : null, Yi = (e, t) => {
	let n = Ji(e);
	return n ? Reflect.apply(n.getElementById, n, [t]) : void 0;
}, Xi = (e) => Ji(e)?.documentElement, Zi = Object.freeze([
	Object.freeze({
		isAvailable: Gi,
		name: "firefox.urlbar-coverage-native-access",
		read: (e) => e.openLocation,
		symbol: "window.openLocation"
	}),
	Object.freeze({
		isAvailable: Gi,
		name: "firefox.urlbar-coverage-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: Ki,
		name: "firefox.urlbar-coverage-urlbar-state",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.hasAttribute"
	}),
	Object.freeze({
		isAvailable: Ki,
		name: "firefox.urlbar-coverage-window-state",
		read: Xi,
		symbol: "document.documentElement.hasAttribute"
	}),
	...zi.map((e) => Object.freeze({
		isAvailable: Ki,
		name: `firefox.urlbar-coverage-${e}`,
		read: (t) => Yi(t, e),
		symbol: `document.elements[${e}]`
	}))
]), Qi = (e, t) => Object.freeze([...Zi.map((t) => {
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
	available: Gi(t),
	name: "firefox.urlbar-coverage-native-ui-handoff",
	requirement: "required",
	symbol: "nativeUi.revealForUrlbar"
}) })]), $i = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, ea = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: $i(e),
	phase: n,
	symbol: r
}), ta = (e, t) => {
	let n = Reflect.apply(e.getAttribute, e, [t]);
	return typeof n == "string" ? n : null;
}, na = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), ra = (e) => {
	if (e.hidden === !0) return !1;
	let t = ta(e, "hidden");
	return t !== null && t !== "false" ? !1 : ta(e, "collapsed") !== "true";
}, ia = (e) => {
	let t = e.children;
	return Object.freeze(!t || typeof t != "object" && !Array.isArray(t) ? [] : Array.from(t));
}, aa = (e, t) => {
	let n = e.classList;
	return Wi(n) && Gi(n.contains) && !!Reflect.apply(n.contains, n, [t]);
}, oa = (e, t) => e.permissions.available === t.permissions.available && e.permissions.hasPermissions === t.permissions.hasPermissions && e.permissions.blocked.length === t.permissions.blocked.length && e.permissions.blocked.every((e, n) => e === t.permissions.blocked[n]) && e.permissions.sharing.length === t.permissions.sharing.length && e.permissions.sharing.every((e, n) => e === t.permissions.sharing[n]) && e.items.length === t.items.length && e.items.every((e, n) => e === t.items[n]);
function sa({ boundary: e, onError: t, requestNativeUiReveal: n, window: r }) {
	if (e.assertOwnsWindow(r), !Wi(r) || typeof t != "function" || typeof n != "function") throw ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_OPTIONS_INVALID", "firefox-urlbar-coverage-create", "window");
	let i = r, a = !1, o = null, s = 0, c = null, l = Object.freeze({
		items: Object.freeze([]),
		permissions: Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		})
	}), u = new Set(), d = () => {
		if (a || !i) throw ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSED", "firefox-urlbar-coverage-access", "window.gURLBar");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, f = (t) => {
		let n = Yi(d(), t);
		if (!Ki(n)) throw ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", `document.elements[${t}]`);
		return n;
	}, p = () => {
		let t = d().gURLBar;
		if (!Ki(t)) throw ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "window.gURLBar.hasAttribute");
		return t;
	}, m = () => {
		let t = Xi(d());
		if (!Ki(t)) throw ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "document.documentElement.hasAttribute");
		return t;
	}, h = () => {
		let t = Qi(d(), n), r = t.find((e) => !e.snapshot.available);
		if (r) throw ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-capability", r.snapshot.symbol, r.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, g = () => {
		let e = p(), t = f("identity-permission-box"), n = Object.freeze(Vi.flatMap(({ id: e, kind: t }) => {
			let n = Yi(d(), e);
			return Ki(n) && na(n, "sharing") ? [t] : [];
		}));
		if (!(ta(e, "pageproxystate") === "valid" || na(e, "persistsearchterms") || n.length > 0)) return Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		});
		let r = Object.freeze(ia(f("blocked-permissions-container")).flatMap((e) => {
			if (!Ki(e) || !na(e, "showing")) return [];
			let t = ta(e, "data-permission-id"), n = t ? Bi[t] : void 0;
			return n ? [n] : [];
		}));
		return Object.freeze({
			available: !0,
			blocked: r,
			hasPermissions: na(t, "hasPermissions"),
			sharing: n
		});
	}, v = () => {
		let e = d(), t = p(), n = new Set();
		na(m(), "remotecontrol") && n.add("remote-control"), na(t, "searchmode") && n.add("search-mode"), na(t, "persistsearchterms") && n.add("persisted-search");
		for (let { id: t, kind: r } of Hi) {
			let i = Yi(e, t);
			Ki(i) && ra(i) && n.add(r);
		}
		let r = Yi(e, "pageActionButton");
		Ki(r) && na(r, "multiple-children") && n.add("more-page-actions");
		for (let e of ia(f("page-action-buttons"))) {
			if (!Ki(e) || !ra(e) || !aa(e, "urlbar-page-action")) continue;
			let t = typeof e.id == "string" ? e.id : "";
			Ui.has(t) || (aa(e, "urlbar-addon-page-action") ? n.add("extension-actions") : na(e, "actionid") && n.add("other-page-actions"));
		}
		return Object.freeze(Ri.filter((e) => n.has(e)));
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
			t(ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED", "firefox-urlbar-coverage-notify", "urlbarCoverage.subscribe", n));
		}
	}, S = (e) => {
		let t = y();
		return oa(l, t) && s > 0 ? !1 : (l = t, s += 1, e && x(), !0);
	}, C = (n) => {
		o = _(n) ? n : ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_EVENT_FAILED", "firefox-urlbar-coverage-event", "window.MutationObserver", n), t(o);
	}, w = Object.freeze({
		openNativeUrlbar() {
			let t = d(), r = t.openLocation;
			if (!Gi(r)) throw ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-native-access", "window.openLocation");
			try {
				if (n() !== !0) throw ea(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_UI_HANDOFF_REJECTED", "firefox-urlbar-native-access", "nativeUi.revealForUrlbar");
				return Reflect.apply(r, t, []), !0;
			} catch (t) {
				throw _(t) ? t : ea(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_ACCESS_FAILED", "firefox-urlbar-native-access", "window.openLocation", t);
			}
		},
		snapshot() {
			return d(), l;
		},
		subscribe(t) {
			if (d(), typeof t != "function") throw ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_LISTENER_INVALID", "firefox-urlbar-coverage-subscribe", "urlbarCoverage.subscribe");
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
			t(ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", n));
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
			if (c = null, u.clear(), i = null, t !== void 0) throw ea(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", t);
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
var ca = Object.freeze([
	"close",
	"minimize",
	"toggle-maximize"
]), la = new Set(ca);
function ua(e) {
	return typeof e == "string" && la.has(e);
}
//#endregion
//#region src/firefox/window-controls.ts
var da = (e) => typeof e == "object" && !!e, fa = (e) => typeof e == "function", pa = (e, t) => {
	let n = e.document;
	if (!(!da(n) || !fa(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, ma = (e) => Object.freeze(e), ha = Object.freeze([
	ma({
		isAvailable: fa,
		name: "window-controls.minimize",
		read: (e) => e.minimize,
		symbol: "window.minimize"
	}),
	ma({
		isAvailable: fa,
		name: "window-controls.maximize",
		read: (e) => e.maximize,
		symbol: "window.maximize"
	}),
	ma({
		isAvailable: fa,
		name: "window-controls.restore",
		read: (e) => e.restore,
		symbol: "window.restore"
	}),
	ma({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.window-state",
		read: (e) => e.windowState,
		symbol: "window.windowState"
	}),
	ma({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.state-maximized",
		read: (e) => e.STATE_MAXIMIZED,
		symbol: "window.STATE_MAXIMIZED"
	}),
	ma({
		isAvailable: fa,
		name: "window-controls.sizemode-events",
		read: (e) => e.addEventListener,
		symbol: "window.addEventListener"
	}),
	ma({
		isAvailable: (e) => da(e) && fa(e.doCommand),
		name: "window-controls.close-command",
		read: (e) => pa(e, "cmd_closeWindow"),
		symbol: "document.cmd_closeWindow.doCommand"
	})
]), ga = (e) => Object.freeze(ha.map((t) => {
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
})), _a = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, va = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: _a(e),
	phase: n,
	symbol: r
}), ya = (e) => {
	let t = e.windowState === e.STATE_MAXIMIZED || typeof e.STATE_FULLSCREEN == "number" && e.windowState === e.STATE_FULLSCREEN;
	return Object.freeze({ maximized: t });
};
function ba({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !da(n) || typeof t != "function") throw va(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_OPTIONS_INVALID", "firefox-window-controls-create", "window");
	let r = n, i = !1, a = new Set(), o, s = () => {
		if (i || !r) throw va(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_DISPOSED", "firefox-window-controls-access", "window");
		return r;
	}, c = () => {
		let t = ga(s()), n = t.find((e) => !e.snapshot.available);
		if (n) throw va(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, l = () => {
		let n;
		try {
			n = ya(s());
		} catch (e) {
			t(e);
			return;
		}
		for (let r of Array.from(a)) try {
			r(n);
		} catch (n) {
			t(va(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBER_FAILED", "firefox-window-controls-notify", "windowControls.subscribe", n));
		}
	}, u = (t) => {
		if (!ua(t)) throw va(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_INVALID", "firefox-window-controls-action", "windowControls.action");
		c();
		let n = s();
		try {
			if (t === "minimize") return Reflect.apply(n.minimize, n, []), !0;
			if (t === "toggle-maximize") return ya(n).maximized ? Reflect.apply(n.restore, n, []) : Reflect.apply(n.maximize, n, []), !0;
			let r = pa(n, "cmd_closeWindow");
			if (!da(r) || !fa(r.doCommand)) throw va(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-action", "document.cmd_closeWindow.doCommand");
			return Reflect.apply(r.doCommand, r, []), !0;
		} catch (n) {
			throw n instanceof g ? n : va(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_FAILED", "firefox-window-controls-action", t === "close" ? "document.cmd_closeWindow.doCommand" : `window.${t}`, n);
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
		throw va(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBE_FAILED", "firefox-window-controls-subscribe", "window.addEventListener", t);
	}
	let d = Object.freeze({
		invoke: u,
		snapshot() {
			return ya(s());
		},
		subscribe(t) {
			if (typeof t != "function") throw va(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_LISTENER_INVALID", "firefox-window-controls-subscribe", "windowControls.subscribe");
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
export { g as FirefoxBridgeError, jt as addCustomizeLayoutEntry, bt as copyCustomizeLayout, vt as copyCustomizeLayoutEntry, St as createCustomizeLayout, xt as createEmptyCustomizeLayout, ae as createFirefoxBookmarksBridge, T as createFirefoxBridgeBoundary, je as createFirefoxBrowserToolsBridge, Xt as createFirefoxDownloadsBridge, Rn as createFirefoxNavigationBridge, fr as createFirefoxTabsBridge, Fi as createFirefoxToolbarWidgetsBridge, sa as createFirefoxUrlbarCoverageBridge, ba as createFirefoxWindowControlsBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, mt as customizeLayoutBounds, Lt as customizeLayoutContainsWidget, ft as customizeSpecialKinds, Dt as findCustomizeLayoutEntry, Nt as getCustomizeLayoutEntry, gt as isCustomizeSpecialKind, _t as isCustomizeWidgetId, _ as isFirefoxBridgeError, Pt as moveCustomizeLayoutEntry, Ct as parseCustomizeLayout, Tt as parseCustomizeStyle, Mt as removeCustomizeLayoutEntry, wt as serializeCustomizeLayout, Et as serializeCustomizeStyle, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic, Ft as withCustomizeAdopted, It as withoutCustomizeAdopted };
