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
//#region src/firefox/bookmarks/support.ts
var E = "resource://gre/modules/PlacesUtils.sys.mjs", D = "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs", O = Object.freeze([
	"bookmark-added",
	"bookmark-removed",
	"bookmark-moved",
	"bookmark-title-changed",
	"bookmark-url-changed"
]), k = /^[A-Za-z0-9_-]{12}$/u, A = new Set([
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
}, ee = (e) => {
	let t = "", n = 0;
	for (let r of e) {
		if (n >= 160) break;
		t += r, n += 1;
	}
	return t;
}, te = (e, t, n, r, i) => {
	if (!j(t) || typeof t.guid != "string" || typeof t.parentGuid != "string" || typeof t.index != "number" || !Number.isSafeInteger(t.index) || t.index < 0 || typeof t.type != "number" || typeof t.title != "string" || (F(e, t.guid, r, "PlacesUtils.bookmarks.fetch.result.guid"), F(e, t.parentGuid, r, "PlacesUtils.bookmarks.fetch.result.parentGuid"), i !== void 0 && t.guid !== i || ![
		n.TYPE_BOOKMARK,
		n.TYPE_FOLDER,
		n.TYPE_SEPARATOR
	].includes(t.type) || t.type === n.TYPE_FOLDER && (!Number.isSafeInteger(t.childCount) || t.childCount < 0))) throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID", r, "PlacesUtils.bookmarks.fetch.result");
	return t;
}, ne = (e, t, n) => {
	if (t.type === n.TYPE_BOOKMARK) return "bookmark";
	if (t.type === n.TYPE_FOLDER) return "folder";
	if (t.type === n.TYPE_SEPARATOR) return "separator";
	throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_TYPE_INVALID", "firefox-bookmarks-snapshot", "PlacesUtils.bookmarks.TYPE_BOOKMARK");
}, I = (e) => {
	if (!j(e) || typeof e.href != "string") return null;
	if (typeof e.protocol == "string") return e.protocol.toLowerCase();
	let t = e.href.indexOf(":");
	return t > 0 ? `${e.href.slice(0, t).toLowerCase()}:` : null;
};
//#endregion
//#region src/firefox/bookmarks/controller.ts
function re({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !j(r) || typeof t != "function" || typeof n != "function") throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_OPTIONS_INVALID", "firefox-bookmarks-create", "ChromeUtils.importESModule");
	let i, a;
	try {
		i = t(E), a = t(D);
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
	}, re = (e) => (S(), v.resolve(e).guid), ie = (t, n = t.title) => {
		let r = ne(e, t, c.bookmarks);
		return Object.freeze({
			hasChildren: r === "folder" && Number.isSafeInteger(t.childCount) && t.childCount > 0,
			id: T(t.guid),
			kind: r,
			title: ee(n)
		});
	}, ae = async (t, n) => {
		S();
		let r;
		try {
			r = await Reflect.apply(c.bookmarks.fetch, c.bookmarks, [t]);
		} catch (t) {
			throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_FAILED", n, "PlacesUtils.bookmarks.fetch", t);
		}
		return S(), r === null ? null : te(e, r, c.bookmarks, n, "guid" in t ? t.guid : void 0);
	}, oe = (t, r) => {
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
	}, se = (t) => {
		p = _(t) ? t : P(e, "FENNEVIA_FIREFOX_BOOKMARKS_OBSERVER_FAILED", "firefox-bookmarks-observer", "PlacesUtils.observers.addListener", t), n(p);
	}, ce = (t) => {
		if (!(f || p)) try {
			if (!Array.isArray(t)) throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEventCallback.events");
			if (t.length > 128) {
				oe(Object.freeze([]), "all");
				return;
			}
			let n = new Set(), r = [];
			for (let i of t) {
				if (!j(i) || typeof i.type != "string" || !O.includes(i.type) || typeof i.parentGuid != "string" || typeof i.isTagging != "boolean") throw P(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEvent");
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
			i.length > 16 ? oe(Object.freeze([]), "all") : i.length > 0 && oe(Object.freeze(i), "parents");
			for (let e of r) N(e);
		} catch (e) {
			se(e);
		}
	}, le = b(() => {
		m && (m = !1, Reflect.apply(c.observers.removeListener, c.observers, [O, ce]));
	}), ue = Object.freeze({
		async children(t, n = {}) {
			let r;
			try {
				r = re(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					parentId: t,
					status: "stale"
				});
				throw e;
			}
			if (!j(n) || Object.keys(n).some((e) => e !== "limit" && e !== "offset")) throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let i = n.limit ?? 32, a = n.offset ?? 0;
			if (!Number.isSafeInteger(i) || i < 1 || i > 32 || !Number.isSafeInteger(a) || a < 0 || a > 1e6) throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let o = await ae({ guid: r }, "firefox-bookmarks-query-parent");
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
				let n = await ae({
					index: e,
					parentGuid: r
				}, "firefox-bookmarks-query-child");
				if (!n || n.parentGuid !== r || n.index !== e) return Object.freeze({
					parentId: t,
					status: "stale"
				});
				d.push(ie(n));
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
				r = re(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					reason: "stale",
					status: "rejected"
				});
				throw e;
			}
			let i = await ae({ guid: r }, "firefox-bookmarks-open-fetch");
			if (!i) return N(r), Object.freeze({
				reason: "stale",
				status: "rejected"
			});
			if (i.type !== c.bookmarks.TYPE_BOOKMARK) return Object.freeze({
				reason: "not-bookmark",
				status: "rejected"
			});
			let a = I(i.url);
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
				let t = await ae({ guid: r }, "firefox-bookmarks-query-roots");
				if (!t || t.type !== c.bookmarks.TYPE_FOLDER) throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.userContentRoots");
				let i;
				try {
					i = Reflect.apply(c.bookmarks.getLocalizedTitle, c.bookmarks, [t]);
				} catch (t) {
					throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_FAILED", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle", t);
				}
				if (typeof i != "string") throw P(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle");
				n.push(ie(t, i));
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
		e.assertRequiredCapabilities(), w(), Reflect.apply(c.observers.addListener, c.observers, [O, ce]), m = !0;
	} catch (t) {
		f = !0, d = null;
		let r;
		try {
			le();
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
		bookmarks: ue,
		dispose() {
			if (f) return !1;
			f = !0, d = null;
			let t;
			try {
				le();
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
var ie = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"application-menu",
	"settings",
	"customize",
	"native-toolbar"
]), ae = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"application-menu"
]), oe = new Set(ie), se = new Set(ae);
function ce(e) {
	return typeof e == "string" && oe.has(e);
}
function le(e) {
	return typeof e == "string" && se.has(e);
}
//#endregion
//#region src/firefox/browser-tools/support.ts
var ue = Object.freeze({ capture: !0 }), de = Object.freeze([
	"appMenu-popup",
	"downloadsPanel",
	"identity-popup",
	"permission-popup",
	"protections-popup",
	"trustpanel-popup",
	"unified-extensions-panel"
]), fe = new Set(de), L = Object.freeze({
	"application-menu": Object.freeze(["appMenu-popup"]),
	downloads: Object.freeze(["downloadsPanel"]),
	extensions: Object.freeze(["unified-extensions-panel"]),
	protections: Object.freeze(["trustpanel-popup", "protections-popup"]),
	"site-information": Object.freeze(["trustpanel-popup", "identity-popup"]),
	"site-permissions": Object.freeze(["permission-popup"])
}), pe = "bottomcenter topright", me = Object.freeze({
	"application-menu": pe,
	downloads: "after_start",
	extensions: "after_end",
	protections: "end_before",
	"site-information": "end_before",
	"site-permissions": "after_end"
}), he = (e) => e === pe, R = (e) => typeof e == "object" && !!e, z = (e) => typeof e == "function", ge = (e) => {
	let t = e.PanelMultiView;
	if (typeof t == "function") {
		let e = t;
		return z(e.openPopup) ? e : null;
	}
	return R(t) && z(t.openPopup) ? t : null;
}, _e = (e) => R(e) && z(e.addEventListener) && z(e.removeEventListener), ve = (e) => R(e) && z(e.click) && z(e.focus), B = (e) => R(e) && z(e.hidePopup) && z(e.moveToAnchor) && z(e.openPopup), V = (e) => typeof e == "number" && Number.isFinite(e) ? e : void 0, ye = (e) => {
	try {
		let t = Reflect.apply(e.getBoundingClientRect, e, []);
		if (!R(t)) return null;
		let n = V(t.left) ?? V(t.x), r = V(t.top) ?? V(t.y), i = V(t.width), a = V(t.height);
		return n === void 0 || r === void 0 || i === void 0 || a === void 0 ? null : Object.freeze({
			height: Math.max(1, Math.round(a)),
			width: Math.max(1, Math.round(i)),
			x: Math.round(n),
			y: Math.round(r)
		});
	} catch {
		return null;
	}
}, be = (e) => {
	let t = V(e.mozInnerScreenX) ?? 0, n = V(e.mozInnerScreenY) ?? 0;
	return Object.freeze({
		x: Math.round(t),
		y: Math.round(n)
	});
}, H = (e, t) => {
	let n = e.document;
	if (!(!R(n) || !z(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, xe = (e) => R(e) ? e.panel : void 0, U = (e) => Object.freeze(e), Se = Object.freeze([
	U({
		isAvailable: (e) => ve(e) && z(e.checkVisibility),
		name: "browser-tools.trust-anchor",
		read: (e) => H(e, "trust-icon-container"),
		symbol: "document.trust-icon-container.click.focus.checkVisibility"
	}),
	U({
		isAvailable: ve,
		name: "browser-tools.identity-anchor",
		read: (e) => H(e, "identity-icon-box"),
		symbol: "document.identity-icon-box.click.focus"
	}),
	U({
		isAvailable: ve,
		name: "browser-tools.protections-anchor",
		read: (e) => H(e, "tracking-protection-icon-container"),
		symbol: "document.tracking-protection-icon-container.click.focus"
	}),
	U({
		isAvailable: ve,
		name: "browser-tools.permissions-anchor",
		read: (e) => H(e, "identity-permission-box"),
		symbol: "document.identity-permission-box.click.focus"
	}),
	U({
		isAvailable: z,
		name: "browser-tools.unified-extensions",
		read: (e) => R(e.gUnifiedExtensions) ? e.gUnifiedExtensions.togglePanel : void 0,
		symbol: "window.gUnifiedExtensions.togglePanel"
	}),
	U({
		isAvailable: z,
		name: "browser-tools.application-menu",
		read: (e) => R(e.PanelUI) ? e.PanelUI.show : void 0,
		symbol: "window.PanelUI.show"
	}),
	U({
		isAvailable: z,
		name: "browser-tools.application-menu-ready",
		read: (e) => R(e.PanelUI) ? e.PanelUI.ensureReady : void 0,
		symbol: "window.PanelUI.ensureReady"
	}),
	U({
		isAvailable: z,
		name: "browser-tools.settings",
		read: (e) => e.openPreferences,
		symbol: "window.openPreferences"
	}),
	U({
		isAvailable: z,
		name: "browser-tools.customize",
		read: (e) => R(e.gCustomizeMode) ? e.gCustomizeMode.enter : void 0,
		symbol: "window.gCustomizeMode.enter"
	}),
	U({
		isAvailable: (e) => R(e) && z(e.focus),
		name: "browser-tools.native-toolbar-focus",
		read: (e) => H(e, "back-button"),
		symbol: "document.back-button.focus"
	}),
	U({
		isAvailable: ve,
		name: "browser-tools.extensions-anchor",
		read: (e) => H(e, "unified-extensions-button"),
		symbol: "document.unified-extensions-button.click.focus"
	}),
	U({
		isAvailable: ve,
		name: "browser-tools.application-menu-anchor",
		read: (e) => H(e, "PanelUI-menu-button"),
		symbol: "document.PanelUI-menu-button.click.focus"
	}),
	U({
		isAvailable: z,
		name: "browser-tools.trust-panel",
		read: (e) => R(e.gTrustPanelHandler) ? e.gTrustPanelHandler.showPopup : void 0,
		symbol: "window.gTrustPanelHandler.showPopup"
	}),
	U({
		isAvailable: z,
		name: "browser-tools.permission-set-anchor",
		read: (e) => R(e.gPermissionPanel) ? e.gPermissionPanel.setAnchor : void 0,
		symbol: "window.gPermissionPanel.setAnchor"
	}),
	U({
		isAvailable: z,
		name: "browser-tools.permission-open-popup",
		read: (e) => R(e.gPermissionPanel) ? e.gPermissionPanel.openPopup : void 0,
		symbol: "window.gPermissionPanel.openPopup"
	}),
	U({
		isAvailable: z,
		name: "browser-tools.downloads-initialize",
		read: (e) => R(e.DownloadsPanel) ? e.DownloadsPanel.initialize : void 0,
		symbol: "window.DownloadsPanel.initialize"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.downloads-panel",
		read: (e) => {
			let t = H(e, "downloadsPanel");
			return B(t) ? t : xe(e.DownloadsPanel);
		},
		symbol: "document.downloadsPanel.openPopup.moveToAnchor.hidePopup"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.application-menu-panel",
		read: (e) => {
			let t = H(e, "appMenu-popup");
			return B(t) ? t : xe(e.PanelUI);
		},
		symbol: "document.appMenu-popup.openPopup.moveToAnchor.hidePopup"
	}),
	U({
		isAvailable: B,
		name: "browser-tools.extensions-panel",
		read: (e) => {
			let t = H(e, "unified-extensions-panel");
			return B(t) ? t : xe(e.gUnifiedExtensions);
		},
		symbol: "document.unified-extensions-panel.openPopup.moveToAnchor.hidePopup"
	}),
	U({
		isAvailable: _e,
		name: "browser-tools.document-events",
		read: (e) => e.document,
		symbol: "document.addEventListener.removeEventListener"
	})
]), Ce = (e) => Object.freeze(Se.map((t) => {
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
})), we = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, W = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: we(e),
	phase: n,
	symbol: r
}), Te = (e) => {
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
}, Ee = (e) => {
	let t = e.state;
	if (t === "open" || t === "showing") return !0;
	let n = e.getAttribute;
	if (!z(n)) return !1;
	let r = Reflect.apply(n, e, ["state"]);
	return r === "open" || r === "showing";
}, De = (e) => R(e) ? R(e.originalTarget) ? e.originalTarget : R(e.target) ? e.target : null : null;
//#endregion
//#region src/firefox/browser-tools/controller.ts
function Oe({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, frame: r, requestNativeUiReveal: i, window: a }) {
	if (t.assertOwnsWindow(a), !R(a) || !R(r) || typeof r.contains != "function" || typeof i != "function" || typeof e != "function" || typeof n != "function") throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID", "firefox-browser-tools-create", "window");
	let o = (e) => Reflect.apply(r.contains, r, [e]) === !0, s = a, c = !1, l = 0, u = null, d = new Set(), f = [], p = new Set(), m = new Set(), h = () => {
		if (c || !s) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED", "firefox-browser-tools-access", "window");
		return s;
	}, g = () => {
		let e = Ce(h()), n = e.find((e) => !e.snapshot.available);
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
		if (!z(a)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", r);
		try {
			await Reflect.apply(a, e, i);
		} catch (e) {
			throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", r, e);
		}
	}, b = (e) => {
		let n = h();
		if (!R(e) || !z(e.getBoundingClientRect) || e.ownerDocument !== n.document || o(e) !== !0) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID", "firefox-browser-tools-action", "browser-tools.host");
		return e;
	}, x = (e) => {
		let t = h();
		for (let n of e) {
			let e = H(t, n);
			if (B(e) && Ee(e)) return e;
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
		if (he(n)) {
			let n = ye(t), r = be(h()), i = e.moveTo;
			if (n && z(i)) try {
				let t = r.x + n.x, a = r.y + n.y + n.height, o = e.getOuterScreenRect;
				if (z(o)) {
					let i = Reflect.apply(o, e, []);
					if (R(i)) {
						let e = V(i.width);
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
		for (let n of de) {
			if (e.has(n)) continue;
			let r = H(t, n);
			B(r) && Ee(r) && w(r, `document.${n}.hidePopup`);
		}
	}, k = (e, t) => {
		let n = e.closest;
		if (z(n)) try {
			if (Reflect.apply(n, e, ["[data-fennevia-address-popup]"]) != null) return "after_end";
			if (Reflect.apply(n, e, ["[data-fennevia-edge=\"left\"]"]) != null) return "end_before";
		} catch {}
		return me[t];
	}, A = (e) => {
		let t = h();
		for (let n of L[e]) {
			let e = H(t, n);
			if (B(e)) return e;
		}
		return x(L[e]);
	}, j = (e) => {
		let n = A(e);
		if (!n) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", `document.${L[e][0]}.openPopup.moveToAnchor.hidePopup`);
		return n;
	}, M = async (e, n, r, i) => {
		let a = h(), o = ge(a), s = ye(n), c = be(a), l, u = () => Ee(e), d = async (e) => {
			try {
				await e();
			} catch (e) {
				return l = e, u();
			}
			return u();
		}, f = () => {
			if (he(r)) try {
				D(e, n, r, `${i}.moveTo`);
			} catch {}
		}, p = o && z(o.openPopup) ? o.openPopup : void 0, m = async (t, n) => !o || !p ? !1 : d(() => Reflect.apply(p, o, [
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
			return !s || !z(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
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
			return !s || !z(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
				c.x + s.x,
				c.y + s.y + s.height,
				!1
			]));
		}, C = (() => {
			let t = e.querySelector;
			if (!z(t)) return !1;
			try {
				return Reflect.apply(t, e, ["panelmultiview"]) != null;
			} catch {
				return !1;
			}
		})(), w = p && (C || he(r)) ? he(r) ? [
			async () => {
				let t = e.openPopupAtScreenRect, i = e.openPopup;
				if (!s || !p || !z(t) || !z(i)) return !1;
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
		] : he(r) ? [
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
		let r = j(e), i = typeof r.id == "string" && r.id ? r.id : L[e][0];
		return Ee(r) ? (E(r, t, n, `document.${i}.moveToAnchor`), r) : (await M(r, t, n, `document.${i}`), r);
	}, P = async () => {
		let e = h(), t = e.promiseDocumentFlushed;
		if (z(t)) try {
			await Reflect.apply(t, e, [() => void 0]);
			return;
		} catch {}
		await Promise.resolve();
	}, F = (e, t = 800) => {
		let n = h(), r = H(n, e);
		return B(r) && Ee(r) ? Promise.resolve(!0) : new Promise((r) => {
			let i = !1, a = (e) => {
				i || (i = !0, r(e));
			}, o = {
				panelId: e,
				resolve: a,
				timeoutHandle: void 0
			}, s = n.setTimeout;
			z(s) ? o.timeoutHandle = Reflect.apply(s, n, [() => {
				m.delete(o);
				let t = H(n, e);
				a(B(t) && Ee(t));
			}, t]) : queueMicrotask(() => {
				m.delete(o);
				let t = H(n, e);
				a(B(t) && Ee(t));
			}), m.add(o);
		});
	}, ee = (e, t) => {
		let n = s;
		for (let r of Array.from(m)) if (r.panelId === e) {
			if (m.delete(r), n && z(n.clearTimeout)) try {
				Reflect.apply(n.clearTimeout, n, [r.timeoutHandle]);
			} catch {}
			r.resolve(t);
		}
	}, te = async (e, t) => {
		let n = b(t), r = L[e][0], i = k(n, e);
		O(new Set(L[e])), await P();
		for (let t of L[e]) S(t);
		return u = Object.freeze({
			host: n,
			panelId: r,
			position: i
		}), u;
	}, ne = () => {
		let e = s;
		if (!e || !R(e.gPermissionPanel)) return;
		let t = e.gPermissionPanel.setAnchor;
		if (z(t)) try {
			Reflect.apply(t, e.gPermissionPanel, [null, "bottomleft topleft"]);
		} catch {}
	}, I = (e) => {
		let t = Object.freeze({
			open: e,
			type: "native-popup"
		});
		for (let e of Array.from(p)) e(t);
	}, re = (e) => {
		if (c) return;
		let t = De(e), n = typeof t?.id == "string" ? t.id : typeof t?.getAttribute == "function" ? t.getAttribute("id") : void 0;
		if (typeof n != "string" || !fe.has(n)) return;
		let r = R(e) ? e.type : void 0;
		if (r === "popupshown") {
			ee(n, !0);
			for (let e of de) e !== n && C(e);
			if (u && B(t)) try {
				D(t, u.host, u.position, `document.${n}.moveToAnchor`);
			} catch {}
			I(!0);
			return;
		}
		if (r === "popuphidden") {
			if (d.has(n)) return;
			u = null, n === "permission-popup" && ne(), C(n), I(!1);
		}
	}, ie = async (e, n) => {
		let r = h(), i = await te(e, n);
		for (let t of L[e]) d.add(t);
		try {
			switch (e) {
				case "site-information":
				case "protections": {
					if (!R(r.gTrustPanelHandler)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gTrustPanelHandler.showPopup");
					try {
						await y(r.gTrustPanelHandler, "showPopup", "window.gTrustPanelHandler.showPopup");
					} catch {}
					let n = x(L[e]);
					return n ? (E(n, i.host, i.position, `document.${n.id ?? i.panelId}.moveToAnchor`), !0) : (await N(e, i.host, i.position), !0);
				}
				case "site-permissions": {
					if (!R(r.gPermissionPanel)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					let n = r.gPermissionPanel.setAnchor;
					if (!z(n)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					try {
						Reflect.apply(n, r.gPermissionPanel, [i.host, i.position]);
					} catch (e) {
						throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor", e);
					}
					try {
						await y(r.gPermissionPanel, "openPopup", "window.gPermissionPanel.openPopup", [Object.freeze({})]);
					} catch {}
					let a = x(L[e]);
					return a ? (E(a, i.host, i.position, "document.permission-popup.moveToAnchor"), !0) : (await N(e, i.host, i.position), !0);
				}
				case "downloads":
					if (!R(r.DownloadsPanel)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.DownloadsPanel.initialize");
					return await y(r.DownloadsPanel, "initialize", "window.DownloadsPanel.initialize"), await N(e, i.host, i.position), !0;
				case "extensions": {
					let n = j(e);
					if (Ee(n)) {
						w(n, "document.unified-extensions-panel.hidePopup"), u = null;
						for (let t of L[e]) C(t);
						return I(!1), !0;
					}
					if (!R(r.gUnifiedExtensions)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gUnifiedExtensions.togglePanel");
					let a = ge(r), o = a && z(a.openPopup) ? a.openPopup : void 0;
					if (a && o) try {
						a.openPopup = (e, ...t) => {
							if (!(R(e) && e.id === "unified-extensions-panel")) return Reflect.apply(o, a, [e, ...t]);
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
					if (Ee(n)) {
						w(n, "document.appMenu-popup.hidePopup"), u = null;
						for (let t of L[e]) C(t);
						return I(!1), !0;
					}
					if (!R(r.PanelUI)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.ensureReady");
					await y(r.PanelUI, "ensureReady", "window.PanelUI.ensureReady");
					let a = r.PanelUI._ensureShortcutsShown;
					if (z(a)) try {
						Reflect.apply(a, r.PanelUI, []);
					} catch {}
					try {
						await N(e, i.host, i.position);
					} catch {}
					let o = A(e);
					if (o && Ee(o)) return !0;
					if (S("appMenu-popup"), !z(r.PanelUI.show)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.show");
					let s = F("appMenu-popup");
					try {
						let e = Reflect.apply(r.PanelUI.show, r.PanelUI, []);
						Promise.resolve(e).catch(() => {});
					} catch (e) {
						throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.PanelUI.show", e);
					}
					await s;
					let c = A(e);
					return c && Ee(c) ? (D(c, i.host, i.position, "document.appMenu-popup.moveTo"), !0) : (await N(e, i.host, i.position), !0);
				}
			}
			throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
		} finally {
			for (let t of L[e]) d.delete(t);
		}
	}, ae = Object.freeze({
		invoke: async (e, n) => {
			if (!ce(e)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			let r = h();
			l += 1;
			try {
				if (le(e)) return await ie(e, n);
				switch (e) {
					case "settings": return await y(r, "openPreferences", "window.openPreferences"), !0;
					case "customize":
						if (!R(r.gCustomizeMode)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gCustomizeMode.enter");
						return await y(r.gCustomizeMode, "enter", "window.gCustomizeMode.enter"), !0;
					case "native-toolbar": {
						v();
						let e = H(r, "back-button");
						if (!R(e) || !z(e.focus)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "document.back-button.focus");
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
			return Te(Ce(h()));
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
		if (!_e(e)) throw W(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", "document.addEventListener.removeEventListener");
		f.push(t.subscribe(e, "popupshown", re, ue), t.subscribe(e, "popuphidden", re, ue));
	} catch (e) {
		c = !0, s = null;
		for (let e of f.reverse()) try {
			e();
		} catch {}
		throw e;
	}
	return Object.freeze({
		assertRequiredCapabilities: g,
		browserTools: ae,
		dispose() {
			if (c) return !1;
			c = !0;
			let e = s;
			u = null, p.clear();
			for (let e of Array.from(m)) m.delete(e), e.resolve(!1);
			if (e) {
				for (let t of de) {
					let n = H(e, t);
					if (B(n) && Ee(n)) try {
						Reflect.apply(n.hidePopup, n, []);
					} catch {}
					C(t);
				}
				ne();
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
//#region src/app/edge-surfaces/contracts.ts
var ke = Object.freeze({
	defaultProgrammaticRevealMs: 1200,
	hideDelayMs: 300,
	maximumProgrammaticRevealMs: 1e4,
	windowLeaveHideDelayMs: 800
}), Ae = Object.freeze({
	hideDelayMs: Object.freeze({
		max: 5e3,
		min: 100
	}),
	programmaticRevealMs: Object.freeze({
		max: 1e4,
		min: 400
	}),
	triggerThicknessCssPixels: Object.freeze({
		max: 24,
		min: 6
	}),
	windowLeaveHideDelayMs: Object.freeze({
		max: 5e3,
		min: 100
	})
}), je = Object.freeze({
	hideDelayMs: ke.hideDelayMs,
	programmaticRevealMs: ke.defaultProgrammaticRevealMs,
	triggerThicknessCssPixels: 12,
	windowLeaveHideDelayMs: ke.windowLeaveHideDelayMs
}), Me = Object.freeze([
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
	autoHideDelay: Ae.hideDelayMs,
	blur: Object.freeze({
		max: 32,
		min: 0
	}),
	edgeTriggerSize: Ae.triggerThicknessCssPixels,
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
	shortcutHintDuration: Object.freeze({
		max: 1e4,
		min: 0
	}),
	surfaceOpacity: Object.freeze({
		max: 100,
		min: 50
	}),
	temporaryRevealDuration: Ae.programmaticRevealMs,
	windowLeaveHideDelay: Ae.windowLeaveHideDelayMs
}), ze = /^#[0-9A-Fa-f]{6}$/u, Be = Object.freeze([
	"accent",
	"border",
	"chromeBackground",
	"surface",
	"text"
]), Ve = /^[a-z][a-z0-9-]{0,63}$/u;
new Set(Me);
var He = new Set(Ne), Ue = new Set(Pe);
new Set(Fe);
var We = new Set(Ie), Ge = new Set(Le), Ke = Object.freeze([
	"separator",
	"spacer",
	"spring"
]);
new Set(Ke);
//#endregion
//#region src/app/toolbar-widgets/errors.ts
var qe = (e) => {
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
//#endregion
//#region src/app/toolbar-widgets/validation.ts
function Je(e) {
	return typeof e == "string" && He.has(e);
}
function Ye(e) {
	return typeof e == "string" && Ue.has(e);
}
function Xe(e) {
	return typeof e == "string" && We.has(e);
}
function Ze(e) {
	return typeof e == "string" && Ge.has(e);
}
function Qe() {
	return Object.freeze({
		accent: "",
		autoHideDelay: je.hideDelayMs,
		blur: 18,
		border: "",
		chromeBackground: "",
		density: "cozy",
		edgeTriggerSize: je.triggerThicknessCssPixels,
		fontSize: 12,
		motion: 180,
		radius: 4,
		saturation: 145,
		shadow: 50,
		shortcutHintDuration: 600,
		surface: "",
		surfaceOpacity: 94,
		temporaryRevealDuration: je.programmaticRevealMs,
		text: "",
		theme: "auto",
		windowLeaveHideDelay: je.windowLeaveHideDelayMs
	});
}
var $e = (e, t) => typeof e == "number" && Number.isSafeInteger(e) && e >= t.min && e <= t.max, et = new Set(Be);
function tt(e) {
	return typeof e == "string" && et.has(e);
}
function nt(e) {
	return typeof e == "string" ? e === "" ? "" : ze.test(e) ? e.toLowerCase() : null : null;
}
var rt = (e) => nt(e);
function it(e) {
	if (!e || typeof e != "object") throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = rt(e.accent), n = rt(e.border), r = rt(e.chromeBackground), i = rt(e.surface), a = rt(e.text);
	if (t === null || n === null || r === null || i === null || a === null || !$e(e.autoHideDelay, Re.autoHideDelay) || !$e(e.blur, Re.blur) || !Ze(e.density) || !$e(e.edgeTriggerSize, Re.edgeTriggerSize) || !$e(e.fontSize, Re.fontSize) || !$e(e.motion, Re.motion) || !$e(e.radius, Re.radius) || !$e(e.saturation, Re.saturation) || !$e(e.shadow, Re.shadow) || !$e(e.shortcutHintDuration, Re.shortcutHintDuration) || !$e(e.surfaceOpacity, Re.surfaceOpacity) || !$e(e.temporaryRevealDuration, Re.temporaryRevealDuration) || !Xe(e.theme) || !$e(e.windowLeaveHideDelay, Re.windowLeaveHideDelay)) throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	return Object.freeze({
		accent: t,
		autoHideDelay: e.autoHideDelay,
		blur: e.blur,
		border: n,
		chromeBackground: r,
		density: e.density,
		edgeTriggerSize: e.edgeTriggerSize,
		fontSize: e.fontSize,
		motion: e.motion,
		radius: e.radius,
		saturation: e.saturation,
		shadow: e.shadow,
		shortcutHintDuration: e.shortcutHintDuration,
		surface: i,
		surfaceOpacity: e.surfaceOpacity,
		temporaryRevealDuration: e.temporaryRevealDuration,
		text: a,
		theme: e.theme,
		windowLeaveHideDelay: e.windowLeaveHideDelay
	});
}
function at(e) {
	if (!e || typeof e != "object") throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = Object.keys(e), n = {};
	for (let r of t) {
		if (tt(r)) {
			let t = rt(e[r]);
			if (t === null) throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
			Object.assign(n, { [r]: t });
			continue;
		}
		Object.assign(n, { [r]: e[r] });
	}
	let r = it({
		...Qe(),
		...n
	});
	if (t.length === 0 || t.some((e) => !(e in r)) || t.some((e) => n[e] !== r[e])) throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let i = {};
	for (let e of t) {
		let t = e;
		Object.assign(i, { [t]: r[t] });
	}
	return Object.freeze(i);
}
function ot() {
	return Object.freeze({
		bottom: Object.freeze([]),
		left: Object.freeze([]),
		right: Object.freeze([]),
		top: Object.freeze([])
	});
}
function st() {
	return Object.freeze({
		available: !1,
		canEdit: !1,
		layoutCustomized: !1,
		palette: Object.freeze([]),
		style: Qe(),
		zones: ot()
	});
}
var ct = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0 && e <= 48, lt = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
function ut(e) {
	if (!e || typeof e != "object") throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	switch (e.type) {
		case "add":
			if (typeof e.token != "string" || !Ve.test(e.token) || !Je(e.zone) || !ct(e.index) || !lt(e.revision)) throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				token: e.token,
				type: "add",
				zone: e.zone
			});
		case "move":
			if (!Je(e.fromZone) || !Je(e.toZone) || !ct(e.fromIndex) || !ct(e.toIndex) || !lt(e.revision)) throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				fromIndex: e.fromIndex,
				fromZone: e.fromZone,
				revision: e.revision,
				toIndex: e.toIndex,
				toZone: e.toZone,
				type: "move"
			});
		case "remove":
			if (!Je(e.zone) || !ct(e.index) || !lt(e.revision)) throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				type: "remove",
				zone: e.zone
			});
		case "reset-layout":
			if (!lt(e.revision)) throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				revision: e.revision,
				type: "reset-layout"
			});
		case "set-style": return Object.freeze({
			style: at(e.style),
			type: "set-style"
		});
		case "reset-style": return Object.freeze({ type: "reset-style" });
		default: throw qe("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	}
}
//#endregion
//#region src/firefox/customize-model.ts
var dt = Object.freeze([
	"separator",
	"spacer",
	"spring"
]), ft = new Set(dt), pt = Object.freeze({
	adoptedMaxEntries: 64,
	serializedMaxLength: 16384,
	widgetIdMaxLength: 128,
	zoneMaxEntries: 48
}), mt = /^[A-Za-z0-9_.-]{1,128}$/u;
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
function ht(e) {
	return typeof e == "string" && ft.has(e);
}
function gt(e) {
	return typeof e == "string" && mt.test(e);
}
function _t(e) {
	if (!e || typeof e != "object") throw G("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	let t = e;
	if (t.type === "widget" && gt(t.id)) return Object.freeze({
		id: t.id,
		type: "widget"
	});
	if (t.type === "special" && ht(t.kind)) return Object.freeze({
		kind: t.kind,
		type: "special"
	});
	if (t.type === "fennevia" && Ye(t.id)) return Object.freeze({
		id: t.id,
		type: "fennevia"
	});
	throw G("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
}
function vt(e) {
	if (!e || typeof e != "object") throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e, n = [];
	for (let e of Ne) {
		let r = t[e];
		if (!Array.isArray(r) || r.length > pt.zoneMaxEntries) throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
		n.push([e, Object.freeze(r.map(_t))]);
	}
	return Object.freeze(Object.fromEntries(n));
}
function yt(e) {
	if (!e || typeof e != "object") throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e;
	if (t.version !== 1 || !Array.isArray(t.adopted) || t.adopted.length > pt.adoptedMaxEntries || t.adopted.some((e) => !gt(e))) throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	return Object.freeze({
		adopted: Object.freeze([...t.adopted]),
		version: 1,
		zones: vt(t.zones)
	});
}
function bt() {
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
function xt(e, t = []) {
	return yt({
		adopted: t,
		version: 1,
		zones: {
			...bt().zones,
			...e
		}
	});
}
function St(e) {
	if (typeof e != "string" || e === "" || e.length > pt.serializedMaxLength) return null;
	try {
		return yt(JSON.parse(e));
	} catch {
		return null;
	}
}
function Ct(e) {
	let t = JSON.stringify(yt(e));
	if (t.length > pt.serializedMaxLength) throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return t;
}
function wt(e) {
	if (typeof e != "string" || e === "" || e.length > pt.serializedMaxLength) return null;
	try {
		let t = JSON.parse(e);
		return !t || typeof t != "object" || t.version !== 1 ? null : it({
			...Qe(),
			...t,
			version: void 0
		});
	} catch {
		return null;
	}
}
function Tt(e) {
	return JSON.stringify({
		...it(e),
		version: 1
	});
}
function Et(e, t) {
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
var Dt = (e) => {
	if (!Je(e)) throw G("FENNEVIA_CUSTOMIZE_MODEL_ZONE_INVALID");
	return e;
}, Ot = (e, t) => {
	if (!Number.isSafeInteger(e) || e < 0) throw G("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return Math.min(e, t);
}, kt = (e, t, n) => Object.freeze({
	adopted: e.adopted,
	version: 1,
	zones: Object.freeze({
		...e.zones,
		[t]: Object.freeze([...n])
	})
});
function At(e, t, n, r) {
	let i = _t(t), a = Dt(n), o = Et(e, i), s = e;
	o && (s = jt(e, o.zone, o.index));
	let c = [...s.zones[a]];
	if (c.length >= pt.zoneMaxEntries) throw G("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return c.splice(Ot(r, c.length), 0, i), kt(s, a, c);
}
function jt(e, t, n) {
	let r = Dt(t), i = [...e.zones[r]];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw G("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i.splice(n, 1), kt(e, r, i);
}
function Mt(e, t, n) {
	let r = Dt(t), i = e.zones[r];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw G("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i[n];
}
function Nt(e, t, n, r, i) {
	let a = Mt(e, t, n), o = jt(e, t, n), s = [...o.zones[Dt(r)]];
	if (s.length >= pt.zoneMaxEntries) throw G("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return s.splice(Ot(i, s.length), 0, a), kt(o, r, s);
}
function Pt(e, t) {
	if (!gt(t)) throw G("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	if (e.adopted.includes(t)) return e;
	if (e.adopted.length >= pt.adoptedMaxEntries) throw G("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return Object.freeze({
		adopted: Object.freeze([...e.adopted, t]),
		version: 1,
		zones: e.zones
	});
}
function Ft(e, t) {
	return e.adopted.includes(t) ? Object.freeze({
		adopted: Object.freeze(e.adopted.filter((e) => e !== t)),
		version: 1,
		zones: e.zones
	}) : e;
}
function It(e, t) {
	return Et(e, {
		id: t,
		type: "widget"
	}) !== null;
}
//#endregion
//#region src/firefox/downloads/support.ts
var Lt = "resource://gre/modules/Downloads.sys.mjs", Rt = (e) => typeof e == "object" && !!e, zt = (e) => typeof e == "function", Bt = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Vt = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Bt(e),
	phase: n,
	symbol: r
}), Ht = (e) => typeof e == "number" && Number.isFinite(e) && Number.isSafeInteger(e) && e >= 0, Ut = (e, t) => {
	if (!Rt(t) || typeof t.stopped != "boolean" || typeof t.succeeded != "boolean" || typeof t.canceled != "boolean" || typeof t.hasPartialData != "boolean" || typeof t.hasProgress != "boolean" || !Number.isInteger(t.progress) || t.progress < 0 || t.progress > 100 || !Ht(t.currentBytes) || !Ht(t.totalBytes)) throw Vt(e, "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID", "firefox-downloads-event", "Download");
	return t;
}, Wt = (e) => e.stopped ? e.succeeded ? "succeeded" : e.error ? "failed" : e.canceled ? e.hasPartialData ? "paused" : "canceled" : "queued" : "active", Gt = (e) => e === "succeeded" || e === "failed" || e === "canceled", Kt = (e) => Math.min(e, 999), qt = () => Object.freeze({
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
//#endregion
//#region src/firefox/downloads/controller.ts
function Jt({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !Rt(r) || typeof t != "function" || typeof n != "function") throw Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_OPTIONS_INVALID", "firefox-downloads-create", "ChromeUtils.importESModule");
	let i;
	try {
		i = t(Lt);
	} catch (t) {
		throw Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_MODULE_LOAD_FAILED", "firefox-downloads-module-load", "ChromeUtils.importESModule", t);
	}
	let a = Rt(i) ? i.Downloads : void 0, o = a, s = e.snapshot().windowKind === "private" ? "private" : "public", c = s === "private" ? o?.PRIVATE : o?.PUBLIC, l = Object.freeze([
		Object.freeze({
			isAvailable: Rt,
			name: "firefox.downloads",
			read: () => a,
			symbol: "Downloads"
		}),
		Object.freeze({
			isAvailable: zt,
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
	]), u = r, d = null, f = !1, p = null, m = !0, h = 0, g = !1, v = !1, y = 0, x = 0, S = !1, C = qt(), w = "", T = new Set(), E = e.createHandleRegistry("download"), D = new Map(), O = new WeakSet(), k = [], A = () => {
		if (f || !u) throw Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSED", "firefox-downloads-access", "window");
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
			available: zt(d.addView),
			name: "firefox.downloads-list-add-view",
			requirement: "required",
			symbol: "DownloadList.addView"
		}) }), Object.freeze({ snapshot: Object.freeze({
			available: zt(d.removeView),
			name: "firefox.downloads-list-remove-view",
			requirement: "required",
			symbol: "DownloadList.removeView"
		}) })), Object.freeze(e);
	}, M = () => {
		A();
		let t = j(), n = t.find((e) => !e.snapshot.available);
		if (n) throw Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, N = (t) => p || (p = _(t) ? t : Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_EVENT_FAILED", "firefox-downloads-event", "DownloadList.view", t), n(p), p), P = (e) => {
		let t = D.get(e);
		if (!t) return !1;
		D.delete(e);
		let n = k.indexOf(e);
		return n !== -1 && k.splice(n, 1), E.release(t.id), !0;
	}, F = (e) => {
		let t = k.indexOf(e);
		for (t !== -1 && k.splice(t, 1), k.unshift(e); k.length > 3;) {
			let e = k.pop();
			e && P(e);
		}
	}, ee = (t) => {
		let n = Ut(e, t), r = Wt(n);
		if (m && (O.add(n), Gt(r))) return;
		let i = D.get(n);
		if (!(!i && Gt(r) && O.has(n))) {
			if (i || (i = {
				currentBytes: 0,
				download: n,
				hasProgress: !1,
				id: E.register(n),
				order: ++x,
				progressPercent: null,
				state: r,
				totalBytes: 0
			}, D.set(n, i)), i.currentBytes = n.currentBytes, i.hasProgress = n.hasProgress, i.progressPercent = r === "succeeded" ? 100 : n.hasProgress ? n.progress : null, i.state = r, i.totalBytes = n.totalBytes, Gt(r)) F(n);
			else {
				let e = k.indexOf(n);
				e !== -1 && k.splice(e, 1);
			}
		}
	}, te = (e) => {
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
	}, ne = () => {
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
		})), i = te(e.active), a = Object.freeze({
			active: e.active.length,
			canceled: e.canceled.length,
			failed: e.failed.length,
			paused: e.paused.length,
			queued: e.queued.length,
			succeeded: e.succeeded.length
		}), o = Object.values(a).some((e) => e > 999);
		return Object.freeze({
			activeCount: Kt(a.active),
			aggregatePercent: i.percent,
			canceledCount: Kt(a.canceled),
			countOverflow: o,
			failedCount: Kt(a.failed),
			items: Object.freeze(r),
			pausedCount: Kt(a.paused),
			phase: v ? "ready" : "loading",
			progressMode: i.mode,
			queuedCount: Kt(a.queued),
			revision: y + 1,
			succeededCount: Kt(a.succeeded),
			truncated: n.length > 6 || o
		});
	}, I = () => {
		if (f || p || m || h > 0) {
			g = !0;
			return;
		}
		g = !1;
		let t = ne(), n = JSON.stringify({
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
				N(Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_SUBSCRIBER_FAILED", "firefox-downloads-notify", "downloads.subscribe", t));
				return;
			}
		}
	}, re = Object.freeze({
		onDownloadAdded(e) {
			if (!(f || p)) try {
				ee(e), I();
			} catch (e) {
				N(e);
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
				ee(e), I();
			} catch (e) {
				N(e);
			}
		},
		onDownloadRemoved(t) {
			if (!(f || p)) try {
				let n = Ut(e, t);
				P(n), I();
			} catch (e) {
				N(e);
			}
		}
	}), ie = b(() => {
		!S || !d || (S = !1, Reflect.apply(d.removeView, d, [re]));
	});
	e.assertRequiredCapabilities(), M();
	let ae = (async () => {
		try {
			let t = await Reflect.apply(o.getList, o, [c]);
			if (f) return !0;
			if (!Rt(t) || !zt(t.addView) || !zt(t.removeView)) throw Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", !Rt(t) || !zt(t.addView) ? "DownloadList.addView" : "DownloadList.removeView");
			if (d = t, S = !0, Reflect.apply(d.addView, d, [re]), f) return ie(), !0;
			if (m = !1, h = 0, p) throw p;
			return v = !0, I(), !0;
		} catch (t) {
			if (f) return !0;
			throw p ?? N(_(t) ? t : Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_INITIALIZATION_FAILED", "firefox-downloads-initialize", "Downloads.getList", t));
		}
	})();
	ae.catch(() => void 0);
	let oe = Object.freeze({
		ready() {
			return A(), ae;
		},
		snapshot() {
			return A(), C;
		},
		subscribe(t) {
			if (A(), typeof t != "function") throw Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_LISTENER_INVALID", "firefox-downloads-subscribe", "downloads.subscribe");
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
				ie();
			} catch (e) {
				t = e;
			}
			T.clear(), D.clear(), k.length = 0;
			try {
				E.dispose();
			} catch (e) {
				t ??= e;
			}
			if (d = null, t !== void 0) throw Vt(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSE_FAILED", "firefox-downloads-dispose", "DownloadList.removeView", t);
			return !0;
		},
		downloads: oe,
		ready() {
			return A(), ae;
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
//#region src/app/locale-state.ts
var Yt = Object.freeze(["en", "zh-Hant"]), Xt = "en", Zt = new Set(Yt), Qt = (e) => {
	let t = Error(e);
	return t.name = "FenneviaLocaleStateError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "locale-state"
		}
	}), t;
}, $t = (e) => e.trim().replaceAll("_", "-").toLowerCase(), en = (e, t) => e === t || e.startsWith(`${t}-`);
function tn(e) {
	return typeof e == "string" && Zt.has(e);
}
function nn(e) {
	return typeof e != "string" || e.trim().length === 0 ? "en" : en($t(e), "zh") ? "zh-Hant" : "en";
}
function rn(e) {
	if (!e || typeof e != "object" || !tn(e.id)) throw Qt("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
	return Object.freeze({ id: e.id });
}
function an(e = "en") {
	if (!tn(e)) throw Qt("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
	let t = Object.freeze({ id: e });
	return Object.freeze({
		snapshot() {
			return t;
		},
		subscribe() {
			return () => !1;
		}
	});
}
//#endregion
//#region src/app/i18n.ts
var on = Object.freeze({
	en: {
		"address.close": "Close",
		"address.closeAria": "Close address and search",
		"address.empty": "Enter an address or search.",
		"address.enterHint": "Enter to open · Escape to cancel",
		"address.fieldLabel": "Enter an address or search",
		"address.firefoxControls": "Firefox address-bar controls",
		"address.loading": "The current page is loading.",
		"address.nativeAccess": "Open full Firefox address bar",
		"address.nativeAccessDescription": "Connection, protection, and permission rows open Firefox's current native panels. Open the full address bar for extension actions and complete controls.",
		"address.noPageActions": "No additional page actions are available for this page.",
		"address.openSiteInformation": "Open Firefox site information. {label}",
		"address.openSitePermissions": "Open Firefox site permissions. {label}",
		"address.openTrackingProtection": "Open Firefox tracking protection. {label}",
		"address.placeholder": "Search or enter address",
		"address.privateBrowsing": "Private browsing",
		"address.productName": "Fennevia",
		"address.statusConnection": "Connection",
		"address.statusProtection": "Protection",
		"address.statusSitePermissions": "Site permissions",
		"address.submitting": "Opening with Firefox…",
		"address.submissionFailed": "Firefox could not open this entry. Native controls remain available.",
		"address.title": "Address and search",
		"address.tooLong": "Keep the address or search under {max} characters.",
		"address.unsafeScheme": "Executable address schemes are not opened here.",
		"address.urlbarItemsAria": "Applicable Firefox address-bar items",
		"bookmarks.collapseLimit": "Collapse a folder before opening another deep branch.",
		"bookmarks.emptyFolder": "No bookmarks here.",
		"bookmarks.error": "Bookmarks are unavailable. Native Firefox tools remain usable.",
		"bookmarks.folderChanged": "This folder changed or was removed.",
		"bookmarks.folderLoadError": "Couldn't load this folder.",
		"bookmarks.folderPages": "Folder pages",
		"bookmarks.hint": "Ctrl or Command + Enter opens a bookmark in a new tab.",
		"bookmarks.listAria": "Bookmarks in selected location",
		"bookmarks.loading": "Loading bookmark locations…",
		"bookmarks.loadingShort": "Loading…",
		"bookmarks.location": "Location",
		"bookmarks.locationTitle": "Bookmark location",
		"bookmarks.next": "Next",
		"bookmarks.openFailed": "Firefox could not open that bookmark.",
		"bookmarks.openNewTab": "Open in new tab",
		"bookmarks.openNewTabAria": "Open {title} in a new tab",
		"bookmarks.pageRange": "{start}–{end} of {total}",
		"bookmarks.panelAria": "Bookmarks",
		"bookmarks.previous": "Previous",
		"bookmarks.retry": "Retry",
		"bookmarks.separator": "Separator",
		"bookmarks.stale": "That bookmark was removed or changed. The list is refreshing.",
		"bookmarks.unsupported": "Executable and data bookmark links are not opened here.",
		"bookmarks.untitledBookmark": "Untitled bookmark",
		"bookmarks.untitledFolder": "Untitled folder",
		"chrome.host.bottom": "Fennevia downloads surface",
		"chrome.host.frame": "Fennevia floating browser shell",
		"chrome.host.left": "Fennevia tabs and address surface",
		"chrome.host.overlay": "Fennevia address and search popup layer",
		"chrome.host.right": "Fennevia bookmarks surface",
		"chrome.host.top": "Fennevia top controls surface",
		"connection.associated.badge": "Linked",
		"connection.associated.label": "Security belongs to an associated page",
		"connection.certificate-error.badge": "Cert",
		"connection.certificate-error.label": "Certificate error",
		"connection.extension.badge": "Extension",
		"connection.extension.label": "Extension page",
		"connection.https-only-error.badge": "HTTPS",
		"connection.https-only-error.label": "HTTPS-Only Mode could not establish a secure connection",
		"connection.internal.badge": "Firefox",
		"connection.internal.label": "Secure Firefox page",
		"connection.local.badge": "Local",
		"connection.local.label": "Local or potentially trustworthy resource",
		"connection.network-error.badge": "Error",
		"connection.network-error.label": "Network error page",
		"connection.not-secure.badge": "HTTP",
		"connection.not-secure.label": "Connection is not secure",
		"connection.secure.badge": "HTTPS",
		"connection.secure.label": "Secure connection",
		"connection.secure-certificate-override.badge": "HTTPS",
		"connection.secure-certificate-override.label": "Secure connection using a certificate exception",
		"connection.secure-qualified-certificate.badge": "HTTPS",
		"connection.secure-qualified-certificate.label": "Secure connection with a qualified website certificate",
		"connection.secure-verified-organization.badge": "HTTPS",
		"connection.secure-verified-organization.label": "Secure connection with verified organization information",
		"connection.unavailable.badge": "Info",
		"connection.unavailable.label": "Connection information is unavailable",
		"customize.addWidgetAria": "Add {label} to the {zone} panel",
		"customize.autoHideDelay": "Hide after entering page",
		"customize.autoHideDelayHelp": "How long a panel remains visible after the pointer moves into page content or another area inside Firefox.",
		"customize.closeAria": "Close customize panel",
		"customize.colorAccent": "Accent color",
		"customize.colorBorder": "Border color",
		"customize.colorCustomAria": "Custom {label} color",
		"customize.colorDefaultAria": "Default {label}",
		"customize.colorDefaultTitle": "Default",
		"customize.colorLabelAria": "{label} {color}",
		"customize.colorPanel": "Panel background",
		"customize.colorSwatchCustom": "Custom color",
		"customize.colorText": "Text color",
		"customize.colorWindow": "Window background",
		"customize.density": "Density",
		"customize.density.comfortable": "Comfortable",
		"customize.density.compact": "Compact",
		"customize.density.cozy": "Cozy",
		"customize.editFailed": "That change could not be applied. The layout may have just changed; try again.",
		"customize.edgeTriggerSize": "Edge trigger size",
		"customize.edgeTriggerSizeHelp": "Width of the invisible edge target. Larger values are easier to hit but cover more of the page edge.",
		"customize.emptyPalette": "Every available widget is already placed. Drop a widget here to remove it from a panel.",
		"customize.followingFirefox": "Following your Firefox toolbar until you make a change. Drag widgets onto the four edge panels.",
		"customize.interaction": "Interaction",
		"customize.interactionHelp": "These settings apply to all four edge panels. Focus, keyboard access, and open popups always keep a panel visible.",
		"customize.keyboardAdd": "Keyboard add targets the {zone} panel. Press Delete on a placed widget to remove it.",
		"customize.labelAccent": "Accent",
		"customize.labelBlur": "Blur",
		"customize.labelBorder": "Border",
		"customize.labelCorners": "Corners",
		"customize.labelMotion": "Motion",
		"customize.labelOpacity": "Opacity",
		"customize.labelPanels": "Panels",
		"customize.labelSaturate": "Saturate",
		"customize.labelShadow": "Shadow",
		"customize.labelSize": "Size",
		"customize.labelType": "Type",
		"customize.labelWindow": "Window",
		"customize.layoutCustomized": "Using your Fennevia layout. Drag widgets onto the four edge panels. Drop them here to remove. Reset to follow the Firefox toolbar again.",
		"customize.paletteAria": "Available widgets",
		"customize.panelAria": "Customize Fennevia shell",
		"customize.resetLayout": "Reset layout",
		"customize.resetStyle": "Reset appearance and interaction",
		"customize.shortcutHintDuration": "Shortcut tips",
		"customize.shortcutHintDurationHelp": "How long keyboard shortcut tips stay visible when an edge panel opens. Set to 0 to hide them entirely.",
		"customize.shortcutHintOff": "Off",
		"customize.style": "Appearance",
		"customize.styleBlur": "Glass blur",
		"customize.styleFontSize": "Font size",
		"customize.styleMotion": "Motion duration",
		"customize.styleOpacity": "Surface opacity",
		"customize.styleRadius": "Corner radius",
		"customize.styleSaturation": "Glass saturation",
		"customize.styleShadow": "Shadow intensity",
		"customize.temporaryRevealDuration": "Temporary reveal",
		"customize.temporaryRevealDurationHelp": "How long actions such as Show bookmarks reveal a panel when it is not otherwise held.",
		"customize.theme": "Theme",
		"customize.theme.auto": "Auto",
		"customize.theme.dark": "Dark",
		"customize.theme.light": "Light",
		"customize.windowLeaveHideDelay": "Hide after leaving window",
		"customize.windowLeaveHideDelayHelp": "How long a panel remains visible after the pointer leaves the Firefox window.",
		"customize.title": "Customize Fennevia",
		"customize.unavailable": "Customization is unavailable in this window. The fixed Fennevia controls and native Firefox customize mode remain usable.",
		"customize.zone.bottom": "bottom",
		"customize.zone.left": "left",
		"customize.zone.right": "right",
		"customize.zone.top": "top",
		"downloads.activeOne": "{count} download active",
		"downloads.activeOther": "{count} downloads active",
		"downloads.canceled": "Canceled",
		"downloads.canceledOne": "{count} download canceled",
		"downloads.canceledOther": "{count} downloads canceled",
		"downloads.detailCanceled": "No transfer is active",
		"downloads.detailFailed": "Use Firefox Downloads for details",
		"downloads.detailFinished": "No transfer is active",
		"downloads.detailIdle": "The surface stays quiet until needed",
		"downloads.detailIndeterminate": "Total size is not yet known",
		"downloads.detailLoading": "Waiting for the native list",
		"downloads.detailOverall": "{percent}% overall",
		"downloads.detailPaused": "Resume from Firefox when ready",
		"downloads.detailQueued": "Waiting to start",
		"downloads.downloading": "Downloading",
		"downloads.failed": "Failed",
		"downloads.failedOne": "{count} recent failure",
		"downloads.failedOther": "{count} recent failures",
		"downloads.finished": "Finished",
		"downloads.finishedOne": "{count} download finished",
		"downloads.finishedOther": "{count} downloads finished",
		"downloads.idle": "Idle",
		"downloads.itemAria": "Download {index}: {label}",
		"downloads.itemAriaPercent": "Download {index}: {label}, {percent}%",
		"downloads.itemTitlePercent": "{label} · {percent}%",
		"downloads.itemsAria": "Current and recent download states",
		"downloads.loading": "Loading downloads",
		"downloads.moreAria": "More downloads are not shown",
		"downloads.none": "No active downloads",
		"downloads.panelAria": "Download progress",
		"downloads.paused": "Paused",
		"downloads.pausedOne": "{count} download paused",
		"downloads.pausedOther": "{count} downloads paused",
		"downloads.progressDeterminate": "Overall download progress: {percent}%",
		"downloads.progressUnknown": "Overall download progress: unknown total size",
		"downloads.queued": "Queued",
		"downloads.queuedOne": "{count} download queued",
		"downloads.queuedOther": "{count} downloads queued",
		"nav.back": "Back",
		"nav.backAria": "Go back",
		"nav.browserToolbar": "Browser toolbar",
		"nav.customizeAria": "Customize Fennevia shell",
		"nav.customizeTitle": "Customize Fennevia",
		"nav.extensions": "Extensions",
		"nav.extensionsAria": "Open Firefox extensions",
		"nav.firefoxMenu": "Firefox menu",
		"nav.firefoxMenuAria": "Open Firefox menu",
		"nav.firefoxTools": "Firefox tools",
		"nav.forward": "Forward",
		"nav.forwardAria": "Go forward",
		"nav.home": "Home",
		"nav.homeAria": "Go to home page",
		"nav.keyboardShortcut": "Keyboard shortcut",
		"nav.launcherAria": "Address and site status",
		"nav.openAddress": "Open address and search",
		"nav.openSiteInformation": "Open Firefox site information. {label}",
		"nav.openTrackingProtection": "Open Firefox tracking protection. {label}",
		"nav.primaryNavigation": "Primary navigation",
		"nav.private": "Private",
		"nav.reload": "Reload",
		"nav.reloadAria": "Reload page",
		"nav.settings": "Settings",
		"nav.settingsAria": "Open Firefox settings",
		"nav.stop": "Stop",
		"nav.stopAria": "Stop loading",
		"permission.blocked.autoplay": "Autoplay blocked",
		"permission.blocked.camera": "Camera blocked",
		"permission.blocked.canvas": "Canvas access blocked",
		"permission.blocked.install": "Add-on install blocked",
		"permission.blocked.local-network": "Local network blocked",
		"permission.blocked.location": "Location blocked",
		"permission.blocked.loopback-network": "Loopback network access blocked",
		"permission.blocked.microphone": "Microphone blocked",
		"permission.blocked.midi": "MIDI blocked",
		"permission.blocked.notifications": "Notifications blocked",
		"permission.blocked.persistent-storage": "Persistent storage blocked",
		"permission.blocked.popups": "Pop-up or redirect blocked",
		"permission.blocked.screen": "Screen sharing blocked",
		"permission.blocked.serial": "Serial device blocked",
		"permission.blocked.xr": "XR access blocked",
		"permission.indicatorsAria": "Firefox permission indicators",
		"permission.sharing.location": "Location in use",
		"permission.sharing.media": "Camera, microphone, or screen in use",
		"permission.sharing.serial": "Serial device in use",
		"permission.sharing.xr": "XR device in use",
		"permission.site.badgeActive": "In use",
		"permission.site.badgeIdle": "Permissions",
		"permission.site.badgeUnavailable": "Permissions —",
		"permission.site.labelActive": "Firefox reports an active site capability",
		"permission.site.labelBlocked": "Firefox is blocking one or more site capabilities",
		"permission.site.labelGranted": "Firefox has site-specific permissions for this page",
		"permission.site.labelNone": "No site permission indicator is active",
		"permission.site.labelUnavailable": "Site permission information is not available for this page",
		"permission.statusAria": "Firefox site status",
		"protection.blocking.badge": "ETP",
		"protection.blocking.label": "Enhanced Tracking Protection is blocking known trackers",
		"protection.detected.badge": "ETP",
		"protection.detected.label": "Trackers were detected but none are currently blocked",
		"protection.exception.badge": "ETP off",
		"protection.exception.label": "Enhanced Tracking Protection is disabled for this site",
		"protection.no-trackers-detected.badge": "ETP",
		"protection.no-trackers-detected.label": "No known trackers detected",
		"protection.unavailable.badge": "ETP —",
		"protection.unavailable.label": "Enhanced Tracking Protection is not available for this page",
		"surface.bottom": "Downloads",
		"surface.left": "Tabs and address",
		"surface.right": "Bookmarks",
		"surface.top": "Browser controls",
		"tab.allowMedia": "Allow media for",
		"tab.attention": "Attention",
		"tab.close": "Close",
		"tab.closeTab": "Close tab",
		"tab.indexOf": "{index} of {total}",
		"tab.loading": "Loading",
		"tab.mediaBlocked": "Media blocked",
		"tab.mute": "Mute",
		"tab.muted": "Muted",
		"tab.newTab": "New tab",
		"tab.newTabAria": "Open new tab",
		"tab.openCount": "{count} open tabs",
		"tab.openHeading": "Open tabs",
		"tab.pin": "Pin",
		"tab.pinTab": "Pin tab",
		"tab.pinned": "Pinned",
		"tab.pip": "Picture in picture",
		"tab.playing": "Playing",
		"tab.unmute": "Unmute",
		"tab.unpin": "Unpin",
		"tab.unpinTab": "Unpin tab",
		"tab.untitled": "Untitled tab",
		"urlbar.bookmark": "Bookmark page",
		"urlbar.container": "Container tab",
		"urlbar.extension-actions": "Extension page actions",
		"urlbar.more-page-actions": "More page actions",
		"urlbar.other-page-actions": "Additional page actions",
		"urlbar.persisted-search": "Persisted search terms",
		"urlbar.picture-in-picture": "Picture-in-Picture",
		"urlbar.reader-view": "Reader View",
		"urlbar.recommendation": "Firefox recommendation",
		"urlbar.remote-control": "Browser under remote control",
		"urlbar.search-mode": "Search mode",
		"urlbar.split-view": "Split view",
		"urlbar.taskbar-tabs": "Taskbar tab controls",
		"urlbar.translations": "Translate page",
		"urlbar.zoom": "Reset page zoom",
		"widget.dropHere": "Drop widgets here",
		"widget.droppableAria": "{zone} panel widgets, droppable",
		"widget.fenneviaControl": "Fennevia control",
		"widget.flexibleSpace": "Flexible space",
		"widget.separator": "Separator",
		"widget.showBookmarks": "Show bookmarks panel",
		"widget.showBookmarksTooltip": "Reveal the Fennevia bookmarks panel",
		"widget.showDownloads": "Open Firefox downloads",
		"widget.showDownloadsTooltip": "Open the Firefox downloads panel",
		"widget.space": "Space",
		"widget.toolbarItem": "Toolbar item",
		"widget.toolbarShortcuts": "Toolbar shortcuts",
		"widget.unavailableSuffix": "{label} (unavailable)",
		"window.close": "Close",
		"window.closeAria": "Close window",
		"window.controls": "Window controls",
		"window.maximize": "Maximize",
		"window.maximizeAria": "Maximize window",
		"window.minimize": "Minimize",
		"window.minimizeAria": "Minimize window",
		"window.restore": "Restore",
		"window.restoreAria": "Restore window"
	},
	"zh-Hant": {
		"address.close": "關閉",
		"address.closeAria": "關閉網址與搜尋",
		"address.empty": "請輸入網址或搜尋。",
		"address.enterHint": "Enter 開啟 · Escape 取消",
		"address.fieldLabel": "輸入網址或搜尋",
		"address.firefoxControls": "Firefox 網址列控制項",
		"address.loading": "目前頁面正在載入。",
		"address.nativeAccess": "開啟完整 Firefox 網址列",
		"address.nativeAccessDescription": "連線、保護與權限列會開啟 Firefox 目前的原生面板。開啟完整網址列可使用擴充功能動作與完整控制項。",
		"address.noPageActions": "此頁面沒有其他可用的頁面動作。",
		"address.openSiteInformation": "開啟 Firefox 網站資訊。{label}",
		"address.openSitePermissions": "開啟 Firefox 網站權限。{label}",
		"address.openTrackingProtection": "開啟 Firefox 追蹤保護。{label}",
		"address.placeholder": "搜尋或輸入網址",
		"address.privateBrowsing": "隱私瀏覽",
		"address.productName": "Fennevia",
		"address.statusConnection": "連線",
		"address.statusProtection": "保護",
		"address.statusSitePermissions": "網站權限",
		"address.submitting": "正在以 Firefox 開啟…",
		"address.submissionFailed": "Firefox 無法開啟此項目。原生控制項仍可使用。",
		"address.title": "網址與搜尋",
		"address.tooLong": "請將網址或搜尋控制在 {max} 個字元以內。",
		"address.unsafeScheme": "不會在此開啟可執行的網址配置。",
		"address.urlbarItemsAria": "適用的 Firefox 網址列項目",
		"bookmarks.collapseLimit": "請先收合一個資料夾，再開啟另一個深層分支。",
		"bookmarks.emptyFolder": "這裡沒有書籤。",
		"bookmarks.error": "書籤無法使用。原生 Firefox 工具仍可使用。",
		"bookmarks.folderChanged": "此資料夾已變更或被移除。",
		"bookmarks.folderLoadError": "無法載入此資料夾。",
		"bookmarks.folderPages": "資料夾分頁",
		"bookmarks.hint": "Ctrl 或 Command + Enter 可在新分頁開啟書籤。",
		"bookmarks.listAria": "所選位置中的書籤",
		"bookmarks.loading": "正在載入書籤位置…",
		"bookmarks.loadingShort": "載入中…",
		"bookmarks.location": "位置",
		"bookmarks.locationTitle": "書籤位置",
		"bookmarks.next": "下一頁",
		"bookmarks.openFailed": "Firefox 無法開啟該書籤。",
		"bookmarks.openNewTab": "在新分頁開啟",
		"bookmarks.openNewTabAria": "在新分頁開啟 {title}",
		"bookmarks.pageRange": "{start}–{end} / 共 {total}",
		"bookmarks.panelAria": "書籤",
		"bookmarks.previous": "上一頁",
		"bookmarks.retry": "重試",
		"bookmarks.separator": "分隔線",
		"bookmarks.stale": "該書籤已移除或變更。清單正在重新整理。",
		"bookmarks.unsupported": "不會在此開啟可執行或資料類型的書籤連結。",
		"bookmarks.untitledBookmark": "未命名書籤",
		"bookmarks.untitledFolder": "未命名資料夾",
		"chrome.host.bottom": "Fennevia 下載面板",
		"chrome.host.frame": "Fennevia 浮動瀏覽器介面",
		"chrome.host.left": "Fennevia 分頁與網址面板",
		"chrome.host.overlay": "Fennevia 網址與搜尋彈出層",
		"chrome.host.right": "Fennevia 書籤面板",
		"chrome.host.top": "Fennevia 頂部控制面板",
		"connection.associated.badge": "關聯",
		"connection.associated.label": "安全性屬於關聯頁面",
		"connection.certificate-error.badge": "憑證",
		"connection.certificate-error.label": "憑證錯誤",
		"connection.extension.badge": "擴充功能",
		"connection.extension.label": "擴充功能頁面",
		"connection.https-only-error.badge": "HTTPS",
		"connection.https-only-error.label": "僅 HTTPS 模式無法建立安全連線",
		"connection.internal.badge": "Firefox",
		"connection.internal.label": "安全的 Firefox 頁面",
		"connection.local.badge": "本機",
		"connection.local.label": "本機或可能可信的資源",
		"connection.network-error.badge": "錯誤",
		"connection.network-error.label": "網路錯誤頁面",
		"connection.not-secure.badge": "HTTP",
		"connection.not-secure.label": "連線不安全",
		"connection.secure.badge": "HTTPS",
		"connection.secure.label": "安全連線",
		"connection.secure-certificate-override.badge": "HTTPS",
		"connection.secure-certificate-override.label": "使用憑證例外的安全連線",
		"connection.secure-qualified-certificate.badge": "HTTPS",
		"connection.secure-qualified-certificate.label": "具合格網站憑證的安全連線",
		"connection.secure-verified-organization.badge": "HTTPS",
		"connection.secure-verified-organization.label": "具已驗證組織資訊的安全連線",
		"connection.unavailable.badge": "資訊",
		"connection.unavailable.label": "無法取得連線資訊",
		"customize.addWidgetAria": "將 {label} 加到{zone}面板",
		"customize.autoHideDelay": "移入網頁後隱藏",
		"customize.autoHideDelayHelp": "指標從面板移入網頁內容或 Firefox 視窗內其他區域後，面板繼續顯示的時間。",
		"customize.closeAria": "關閉自訂面板",
		"customize.colorAccent": "強調色",
		"customize.colorBorder": "邊框顏色",
		"customize.colorCustomAria": "自訂{label}顏色",
		"customize.colorDefaultAria": "預設{label}",
		"customize.colorDefaultTitle": "預設",
		"customize.colorLabelAria": "{label} {color}",
		"customize.colorPanel": "面板背景",
		"customize.colorSwatchCustom": "自訂顏色",
		"customize.colorText": "文字顏色",
		"customize.colorWindow": "視窗背景",
		"customize.density": "密度",
		"customize.density.comfortable": "寬鬆",
		"customize.density.compact": "緊湊",
		"customize.density.cozy": "適中",
		"customize.editFailed": "無法套用該變更。版面可能剛改變，請再試一次。",
		"customize.edgeTriggerSize": "邊緣觸發區",
		"customize.edgeTriggerSizeHelp": "隱形邊緣目標的寬度。數值越大越容易觸發，但會覆蓋較多網頁邊緣。",
		"customize.emptyPalette": "所有可用元件都已放置。將元件拖到這裡可從面板移除。",
		"customize.followingFirefox": "在你做出變更之前會跟隨 Firefox 工具列。將元件拖到四個邊緣面板。",
		"customize.interaction": "互動",
		"customize.interactionHelp": "這些設定會套用到四個邊緣面板。面板取得焦點、經鍵盤開啟或有彈出面板時，將一律保持顯示。",
		"customize.keyboardAdd": "鍵盤新增會放到{zone}面板。在已放置的元件上按 Delete 可移除。",
		"customize.labelAccent": "強調",
		"customize.labelBlur": "模糊",
		"customize.labelBorder": "邊框",
		"customize.labelCorners": "圓角",
		"customize.labelMotion": "動畫",
		"customize.labelOpacity": "不透明度",
		"customize.labelPanels": "面板",
		"customize.labelSaturate": "飽和",
		"customize.labelShadow": "陰影",
		"customize.labelSize": "大小",
		"customize.labelType": "文字",
		"customize.labelWindow": "視窗",
		"customize.layoutCustomized": "正在使用你的 Fennevia 版面。將元件拖到四個邊緣面板。拖到這裡可移除。重設後會再次跟隨 Firefox 工具列。",
		"customize.paletteAria": "可用元件",
		"customize.panelAria": "自訂 Fennevia 介面",
		"customize.resetLayout": "重設版面",
		"customize.resetStyle": "重設外觀與互動",
		"customize.shortcutHintDuration": "快速鍵提示",
		"customize.shortcutHintDurationHelp": "邊緣面板開啟時，鍵盤快速鍵提示要顯示多久。設為 0 可完全隱藏提示。",
		"customize.shortcutHintOff": "不顯示",
		"customize.style": "外觀",
		"customize.styleBlur": "玻璃模糊",
		"customize.styleFontSize": "字型大小",
		"customize.styleMotion": "動畫時長",
		"customize.styleOpacity": "表面不透明度",
		"customize.styleRadius": "圓角半徑",
		"customize.styleSaturation": "玻璃飽和度",
		"customize.styleShadow": "陰影強度",
		"customize.temporaryRevealDuration": "暫時顯示",
		"customize.temporaryRevealDurationHelp": "「顯示書籤」等動作在沒有其他保持狀態時，讓面板顯示多久。",
		"customize.theme": "主題",
		"customize.theme.auto": "自動",
		"customize.theme.dark": "深色",
		"customize.theme.light": "淺色",
		"customize.windowLeaveHideDelay": "離開視窗後隱藏",
		"customize.windowLeaveHideDelayHelp": "指標離開 Firefox 視窗後，面板繼續顯示的時間。",
		"customize.title": "自訂 Fennevia",
		"customize.unavailable": "此視窗無法自訂。固定的 Fennevia 控制項與原生 Firefox 自訂模式仍可使用。",
		"customize.zone.bottom": "底部",
		"customize.zone.left": "左側",
		"customize.zone.right": "右側",
		"customize.zone.top": "頂部",
		"downloads.activeOne": "{count} 個下載進行中",
		"downloads.activeOther": "{count} 個下載進行中",
		"downloads.canceled": "已取消",
		"downloads.canceledOne": "{count} 個下載已取消",
		"downloads.canceledOther": "{count} 個下載已取消",
		"downloads.detailCanceled": "目前沒有傳輸",
		"downloads.detailFailed": "請使用 Firefox 下載管理查看詳細資料",
		"downloads.detailFinished": "目前沒有傳輸",
		"downloads.detailIdle": "有需要時才會顯示此面板",
		"downloads.detailIndeterminate": "尚不知道總大小",
		"downloads.detailLoading": "正在等待原生清單",
		"downloads.detailOverall": "整體 {percent}%",
		"downloads.detailPaused": "就緒後請從 Firefox 繼續",
		"downloads.detailQueued": "等待開始",
		"downloads.downloading": "下載中",
		"downloads.failed": "失敗",
		"downloads.failedOne": "{count} 個最近失敗",
		"downloads.failedOther": "{count} 個最近失敗",
		"downloads.finished": "已完成",
		"downloads.finishedOne": "{count} 個下載已完成",
		"downloads.finishedOther": "{count} 個下載已完成",
		"downloads.idle": "閒置",
		"downloads.itemAria": "下載 {index}：{label}",
		"downloads.itemAriaPercent": "下載 {index}：{label}，{percent}%",
		"downloads.itemTitlePercent": "{label} · {percent}%",
		"downloads.itemsAria": "目前與最近的下載狀態",
		"downloads.loading": "正在載入下載",
		"downloads.moreAria": "還有下載未顯示",
		"downloads.none": "沒有進行中的下載",
		"downloads.panelAria": "下載進度",
		"downloads.paused": "已暫停",
		"downloads.pausedOne": "{count} 個下載已暫停",
		"downloads.pausedOther": "{count} 個下載已暫停",
		"downloads.progressDeterminate": "整體下載進度：{percent}%",
		"downloads.progressUnknown": "整體下載進度：總大小未知",
		"downloads.queued": "佇列中",
		"downloads.queuedOne": "{count} 個下載在佇列中",
		"downloads.queuedOther": "{count} 個下載在佇列中",
		"nav.back": "上一頁",
		"nav.backAria": "返回上一頁",
		"nav.browserToolbar": "瀏覽器工具列",
		"nav.customizeAria": "自訂 Fennevia 介面",
		"nav.customizeTitle": "自訂 Fennevia",
		"nav.extensions": "擴充功能",
		"nav.extensionsAria": "開啟 Firefox 擴充功能",
		"nav.firefoxMenu": "Firefox 選單",
		"nav.firefoxMenuAria": "開啟 Firefox 選單",
		"nav.firefoxTools": "Firefox 工具",
		"nav.forward": "下一頁",
		"nav.forwardAria": "前進到下一頁",
		"nav.home": "首頁",
		"nav.homeAria": "前往首頁",
		"nav.keyboardShortcut": "鍵盤快速鍵",
		"nav.launcherAria": "網址與網站狀態",
		"nav.openAddress": "開啟網址與搜尋",
		"nav.openSiteInformation": "開啟 Firefox 網站資訊。{label}",
		"nav.openTrackingProtection": "開啟 Firefox 追蹤保護。{label}",
		"nav.primaryNavigation": "主要導覽",
		"nav.private": "隱私",
		"nav.reload": "重新載入",
		"nav.reloadAria": "重新載入頁面",
		"nav.settings": "設定",
		"nav.settingsAria": "開啟 Firefox 設定",
		"nav.stop": "停止",
		"nav.stopAria": "停止載入",
		"permission.blocked.autoplay": "已封鎖自動播放",
		"permission.blocked.camera": "已封鎖攝影機",
		"permission.blocked.canvas": "已封鎖畫布存取",
		"permission.blocked.install": "已封鎖附加元件安裝",
		"permission.blocked.local-network": "已封鎖本機網路",
		"permission.blocked.location": "已封鎖位置",
		"permission.blocked.loopback-network": "已封鎖回送網路存取",
		"permission.blocked.microphone": "已封鎖麥克風",
		"permission.blocked.midi": "已封鎖 MIDI",
		"permission.blocked.notifications": "已封鎖通知",
		"permission.blocked.persistent-storage": "已封鎖持續性儲存空間",
		"permission.blocked.popups": "已封鎖彈出式視窗或重新導向",
		"permission.blocked.screen": "已封鎖螢幕分享",
		"permission.blocked.serial": "已封鎖序列裝置",
		"permission.blocked.xr": "已封鎖 XR 存取",
		"permission.indicatorsAria": "Firefox 權限指示器",
		"permission.sharing.location": "正在使用位置",
		"permission.sharing.media": "正在使用攝影機、麥克風或螢幕",
		"permission.sharing.serial": "正在使用序列裝置",
		"permission.sharing.xr": "正在使用 XR 裝置",
		"permission.site.badgeActive": "使用中",
		"permission.site.badgeIdle": "權限",
		"permission.site.badgeUnavailable": "權限 —",
		"permission.site.labelActive": "Firefox 回報網站功能正在使用中",
		"permission.site.labelBlocked": "Firefox 正在封鎖一或多項網站功能",
		"permission.site.labelGranted": "Firefox 對此頁面具有網站專屬權限",
		"permission.site.labelNone": "目前沒有作用中的網站權限指示器",
		"permission.site.labelUnavailable": "此頁面無法取得網站權限資訊",
		"permission.statusAria": "Firefox 網站狀態",
		"protection.blocking.badge": "ETP",
		"protection.blocking.label": "加強型追蹤保護正在封鎖已知追蹤器",
		"protection.detected.badge": "ETP",
		"protection.detected.label": "偵測到追蹤器，但目前未封鎖任何項目",
		"protection.exception.badge": "ETP 關閉",
		"protection.exception.label": "已為此網站停用加強型追蹤保護",
		"protection.no-trackers-detected.badge": "ETP",
		"protection.no-trackers-detected.label": "未偵測到已知追蹤器",
		"protection.unavailable.badge": "ETP —",
		"protection.unavailable.label": "此頁面無法使用加強型追蹤保護",
		"surface.bottom": "下載",
		"surface.left": "分頁與網址",
		"surface.right": "書籤",
		"surface.top": "瀏覽器控制項",
		"tab.allowMedia": "允許媒體：",
		"tab.attention": "需要注意",
		"tab.close": "關閉",
		"tab.closeTab": "關閉分頁",
		"tab.indexOf": "第 {index} 個，共 {total} 個",
		"tab.loading": "載入中",
		"tab.mediaBlocked": "已封鎖媒體",
		"tab.mute": "靜音",
		"tab.muted": "已靜音",
		"tab.newTab": "新分頁",
		"tab.newTabAria": "開啟新分頁",
		"tab.openCount": "{count} 個開啟的分頁",
		"tab.openHeading": "開啟的分頁",
		"tab.pin": "釘選",
		"tab.pinTab": "釘選分頁",
		"tab.pinned": "已釘選",
		"tab.pip": "子母畫面",
		"tab.playing": "播放中",
		"tab.unmute": "取消靜音",
		"tab.unpin": "取消釘選",
		"tab.unpinTab": "取消釘選分頁",
		"tab.untitled": "未命名分頁",
		"urlbar.bookmark": "將此頁加入書籤",
		"urlbar.container": "容器分頁",
		"urlbar.extension-actions": "擴充功能頁面動作",
		"urlbar.more-page-actions": "更多頁面動作",
		"urlbar.other-page-actions": "其他頁面動作",
		"urlbar.persisted-search": "保留的搜尋詞",
		"urlbar.picture-in-picture": "子母畫面",
		"urlbar.reader-view": "閱讀模式",
		"urlbar.recommendation": "Firefox 建議",
		"urlbar.remote-control": "瀏覽器正被遠端控制",
		"urlbar.search-mode": "搜尋模式",
		"urlbar.split-view": "分割檢視",
		"urlbar.taskbar-tabs": "工作列分頁控制項",
		"urlbar.translations": "翻譯頁面",
		"urlbar.zoom": "重設頁面縮放",
		"widget.dropHere": "將元件拖放到這裡",
		"widget.droppableAria": "{zone} 面板元件，可放置",
		"widget.fenneviaControl": "Fennevia 控制項",
		"widget.flexibleSpace": "彈性空間",
		"widget.separator": "分隔線",
		"widget.showBookmarks": "顯示書籤面板",
		"widget.showBookmarksTooltip": "顯示 Fennevia 書籤面板",
		"widget.showDownloads": "開啟 Firefox 下載",
		"widget.showDownloadsTooltip": "開啟 Firefox 下載面板",
		"widget.space": "空白",
		"widget.toolbarItem": "工具列項目",
		"widget.toolbarShortcuts": "工具列捷徑",
		"widget.unavailableSuffix": "{label}（無法使用）",
		"window.close": "關閉",
		"window.closeAria": "關閉視窗",
		"window.controls": "視窗控制項",
		"window.maximize": "最大化",
		"window.maximizeAria": "最大化視窗",
		"window.minimize": "最小化",
		"window.minimizeAria": "最小化視窗",
		"window.restore": "還原",
		"window.restoreAria": "還原視窗"
	}
});
function sn(e, t) {
	return t ? e.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, (e, n) => {
		let r = t[n];
		return r === void 0 ? e : String(r);
	}) : e;
}
function cn(e, t, n) {
	return sn((on[e] ?? on.en)[t] ?? on.en[t] ?? t, n);
}
//#endregion
//#region src/firefox/locale.ts
var ln = "intl:app-locales-changed", un = Object.freeze([
	"frame",
	"overlay",
	"top",
	"left",
	"right",
	"bottom"
]), dn = Object.freeze({
	bottom: "chrome.host.bottom",
	frame: "chrome.host.frame",
	left: "chrome.host.left",
	overlay: "chrome.host.overlay",
	right: "chrome.host.right",
	top: "chrome.host.top"
}), fn = (e) => typeof e == "object" && !!e, pn = (e) => typeof e == "function", mn = (e) => {
	let t = e.Services;
	if (!fn(t)) return null;
	let n = t.locale;
	return fn(n) ? n : null;
}, hn = (e) => {
	let t = e.Services;
	if (!fn(t)) return null;
	let n = t.obs;
	return !fn(n) || !pn(n.addObserver) || !pn(n.removeObserver) ? null : n;
}, gn = Object.freeze([Object.freeze({
	isAvailable: (e) => e !== null,
	name: "locale.app-locale",
	read: (e) => mn(e),
	requirement: "optional",
	symbol: "window.Services.locale.appLocaleAsBCP47"
}), Object.freeze({
	isAvailable: (e) => e !== null,
	name: "locale.app-locales-observer",
	read: (e) => hn(e),
	requirement: "optional",
	symbol: "window.Services.obs.addObserver.removeObserver"
})]), _n = (e) => Object.freeze(gn.map((t) => {
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
})), vn = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, yn = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: vn(e),
	phase: n,
	symbol: r
}), bn = (e) => {
	let t = mn(e);
	if (!t) return "";
	try {
		let e = t.appLocaleAsBCP47;
		return typeof e == "string" ? e : "";
	} catch {
		return "";
	}
}, xn = (e) => Object.freeze({ id: nn(bn(e)) }), Sn = (e, t) => cn(e, dn[t]);
function Cn({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !fn(n)) throw yn(e, "FENNEVIA_FIREFOX_LOCALE_OPTIONS_INVALID", "firefox-locale-create", "window");
	let r = typeof t == "function" ? t : () => {}, i = n, a = !1, o = new Set(), s = !1, c = Object.freeze({ observe() {
		u();
	} }), l = () => {
		if (a || !i) throw yn(e, "FENNEVIA_FIREFOX_LOCALE_DISPOSED", "firefox-locale-access", "window");
		return i;
	}, u = () => {
		let t;
		try {
			t = xn(l());
		} catch (e) {
			r(e);
			return;
		}
		for (let n of Array.from(o)) try {
			n(t);
		} catch (t) {
			r(yn(e, "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBER_FAILED", "firefox-locale-notify", "locale.subscribe", t));
		}
	}, d = () => {
		if (!s || !i) {
			s = !1;
			return;
		}
		let e = hn(i);
		if (e) try {
			Reflect.apply(e.removeObserver, e, [c, ln]);
		} catch {}
		s = !1;
	}, f = hn(n);
	if (f) try {
		Reflect.apply(f.addObserver, f, [c, ln]), s = !0;
	} catch (t) {
		r(yn(e, "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBE_FAILED", "firefox-locale-subscribe", "window.Services.obs.addObserver", t));
	}
	let p = Object.freeze({
		snapshot() {
			return rn(xn(l()));
		},
		subscribe(t) {
			if (typeof t != "function") throw yn(e, "FENNEVIA_FIREFOX_LOCALE_LISTENER_INVALID", "firefox-locale-subscribe", "locale.subscribe");
			return l(), o.add(t), () => o.delete(t);
		}
	});
	return Object.freeze({
		assertRequiredCapabilities() {
			let t = _n(l()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
			if (n) throw yn(e, "FENNEVIA_FIREFOX_LOCALE_CAPABILITY_MISSING", "firefox-locale-capability", n.snapshot.symbol, n.cause);
			return Object.freeze(t.map((e) => e.snapshot));
		},
		dispose() {
			return !a && (a = !0, d(), i = null, o.clear(), !0);
		},
		locale: p,
		snapshot() {
			return Object.freeze({ disposed: a });
		}
	});
}
//#endregion
//#region src/app/navigation-state.ts
var wn = 2048, Tn = 4096, En = (e) => {
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
function Dn(e) {
	if (!e || typeof e != "object") throw En("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	let t = e;
	if (typeof t.altKey != "boolean" || typeof t.ctrlKey != "boolean" || typeof t.metaKey != "boolean" || typeof t.shiftKey != "boolean" || !Number.isInteger(t.button) || t.button < 0 || t.button > 2) throw En("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	return Object.freeze({
		altKey: t.altKey,
		button: t.button,
		ctrlKey: t.ctrlKey,
		metaKey: t.metaKey,
		shiftKey: t.shiftKey
	});
}
//#endregion
//#region src/firefox/navigation/support.ts
var On = Object.freeze({
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
}), kn = Object.freeze(["TabSelect", "TabAttrModified"]), An = new Set([
	"busy",
	"label",
	"selected"
]), jn = "Browser:OpenLocation", Mn = Object.freeze({
	selectAll: !0,
	source: "ctrl-l",
	type: "address-popup-open"
}), Nn = Object.freeze({ status: "accepted" }), Pn = Object.freeze({
	reason: "empty",
	status: "rejected"
}), Fn = Object.freeze({
	reason: "too-long",
	status: "rejected"
}), In = Object.freeze({
	reason: "unsafe-scheme",
	status: "rejected"
}), Ln = /^\s*(?:data|javascript|vbscript)\s*:/iu, Rn = new Set([
	"about:blank",
	"about:home",
	"about:newtab",
	"about:privatebrowsing"
]), zn = Object.freeze({
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
}), Bn = (e) => `document.commands[${e.replaceAll(":", "-")}]`, K = (e) => typeof e == "object" && !!e, q = (e) => typeof e == "function", Vn = (e) => K(e) && q(e.addEventListener) && q(e.removeEventListener), Hn = (e) => e.gBrowser, Un = (e, t) => {
	let n = Hn(e);
	return K(n) ? n[t] : void 0;
}, Wn = (e, t) => {
	let n = Un(e, "selectedBrowser");
	return K(n) ? n[t] : void 0;
}, Gn = (e, t) => {
	let n = e.BrowserCommands;
	return K(n) ? n[t] : void 0;
}, Kn = (e, t) => {
	let n = e.gURLBar;
	return K(n) ? n[t] : void 0;
}, qn = (e, t) => e[t], Jn = (e) => {
	let t = e.document;
	return K(t) ? t.documentElement : void 0;
}, Yn = (e, t) => {
	let n = e.document;
	if (!(!K(n) || !q(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Xn = (e) => K(e) && q(e.hasAttribute), Zn = (e) => Vn(e) && typeof e.value == "string" && q(e.getAttribute) && q(e.handleCommand), Qn = (e) => K(e) && q(e.getConnectionSecurityInformation), $n = (e) => K(e) && q(e.onContentBlockingEvent), er = (e) => K(e) && q(e.canHandle), tr = (e) => K(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", nr = (e) => K(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), rr = Object.freeze([
	Object.freeze({
		isAvailable: tr,
		name: "firefox.navigation-selected-browser",
		read: (e) => Un(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: nr,
		name: "firefox.navigation-current-uri",
		read: (e) => Wn(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-selected-browser-focus",
		read: (e) => Wn(e, "focus"),
		symbol: "window.gBrowser.selectedBrowser.focus"
	}),
	Object.freeze({
		isAvailable: (e) => K(e) && q(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => Un(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: Vn,
		name: "firefox.navigation-tab-events",
		read: (e) => Un(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: q,
		name: `firefox.navigation-${e}`,
		read: (e) => Un(e, t),
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
		read: (e) => Kn(e, "value"),
		symbol: "window.gURLBar.value"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-urlbar-submission",
		read: (e) => Kn(e, "handleCommand"),
		symbol: "window.gURLBar.handleCommand"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-urlbar-proxy-state",
		read: (e) => Kn(e, "getAttribute"),
		symbol: "window.gURLBar.getAttribute"
	}),
	Object.freeze({
		isAvailable: Qn,
		name: "firefox.navigation-connection-security",
		read: (e) => qn(e, "gIdentityHandler"),
		symbol: "window.gIdentityHandler.getConnectionSecurityInformation"
	}),
	Object.freeze({
		isAvailable: $n,
		name: "firefox.navigation-tracking-protection",
		read: (e) => qn(e, "gProtectionsHandler"),
		symbol: "window.gProtectionsHandler.onContentBlockingEvent"
	}),
	Object.freeze({
		isAvailable: er,
		name: "firefox.navigation-tracking-protection-availability",
		read: (e) => qn(e, "ContentBlockingAllowList"),
		symbol: "window.ContentBlockingAllowList.canHandle"
	}),
	Object.freeze({
		isAvailable: (e) => Xn(e) && Vn(e),
		name: "firefox.navigation-open-location-command",
		read: (e) => Yn(e, jn),
		symbol: Bn(jn)
	}),
	Object.freeze({
		isAvailable: (e) => K(e) && q(e.hasAttribute),
		name: "firefox.navigation-shell-health-gate",
		read: Jn,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Object.values(On).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: Xn,
		name: `firefox.navigation-command-${t}`,
		read: (t) => Yn(t, e),
		symbol: Bn(e)
	}), Object.freeze({
		isAvailable: q,
		name: `firefox.navigation-action-${t}`,
		read: (e) => Gn(e, t),
		symbol: `window.BrowserCommands.${t}`
	})]),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-action-home",
		read: (e) => Gn(e, "home"),
		symbol: "window.BrowserCommands.home"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-action-reloadOrDuplicate",
		read: (e) => Gn(e, "reloadOrDuplicate"),
		symbol: "window.BrowserCommands.reloadOrDuplicate"
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
}, J = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: ar(e),
	phase: n,
	symbol: r
}), or = (e, t) => e.addressValue === t.addressValue && e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.connectionSecurity === t.connectionSecurity && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title && e.trackingProtection === t.trackingProtection, sr = (e) => {
	if (!K(e) || !K(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => An.has(e));
};
//#endregion
//#region src/firefox/navigation/controller.ts
function cr({ boundary: e, onError: t, window: n }) {
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
		if (!tr(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, g = () => {
		let t = m().selectedTab;
		if (!K(t) || !q(t.getAttribute)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, v = (t) => {
		let n = Yn(p(), t);
		if (!Xn(n)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", Bn(t));
		return n;
	}, y = () => {
		let t = p().gURLBar;
		if (!Zn(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gURLBar.handleCommand");
		return t;
	}, x = () => {
		let t = p().gIdentityHandler;
		if (!Qn(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gIdentityHandler.getConnectionSecurityInformation");
		return t;
	}, S = () => {
		let t = p().gProtectionsHandler;
		if (!$n(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gProtectionsHandler.onContentBlockingEvent");
		return t;
	}, C = () => {
		let t = p().ContentBlockingAllowList;
		if (!er(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.ContentBlockingAllowList.canHandle");
		return t;
	}, w = () => {
		let t = ir(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (e) => {
		let t = v(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, E = (t) => {
		let n = t.currentURI;
		if (!nr(n)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, wn);
	}, D = (e) => {
		if (Rn.has(e)) return "";
		let t = y();
		return (Reflect.apply(t.getAttribute, t, ["pageproxystate"]) === "valid" ? t.value : e).slice(0, Tn);
	}, O = () => {
		let e = x(), t = Reflect.apply(e.getConnectionSecurityInformation, e, []);
		return typeof t == "string" ? zn[t] ?? "unavailable" : "unavailable";
	}, k = (e) => {
		let t = C();
		if (Reflect.apply(t.canHandle, t, [e]) !== !0) return "unavailable";
		let n = S();
		return typeof n.hasException != "boolean" || typeof n.anyBlocking != "boolean" || typeof n.anyDetected != "boolean" ? "unavailable" : n.hasException ? "exception" : n.anyBlocking ? "blocking" : n.anyDetected ? "detected" : "no-trackers-detected";
	}, A = () => {
		let e = h(), t = g(), n = E(e);
		return Object.freeze({
			addressValue: D(n),
			canGoBack: T(On.back.id),
			canGoForward: T(On.forward.id),
			connectionSecurity: O(),
			displayUri: n,
			loading: T(On.stop.id),
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
		return or(s, t) && o > 0 ? !1 : (s = t, o += 1, e && j(), !0);
	}, N = (n, r) => {
		a = _(n) ? n : J(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, P = (e) => {
		if (!(i || a)) try {
			M(!0);
		} catch (t) {
			N(t, e);
		}
	}, F = (e, t, n) => {
		if (!(i || a)) try {
			e === m().selectedBrowser && K(t) && t.isTopLevel === !0 && M(!0);
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
	}), te = (e) => ({
		altKey: e.altKey,
		button: e.button,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		preventDefault() {},
		shiftKey: e.shiftKey
	}), ne = (t, n) => {
		let r = p().BrowserCommands, i = K(r) ? r[t] : void 0;
		if (!q(i)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${t}`);
		try {
			return Reflect.apply(i, r, n === void 0 ? [] : [te(n)]), !0;
		} catch (n) {
			throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${t}`, n);
		}
	}, I = (e, t = !0, n) => {
		let r = On[e];
		h();
		let i = v(r.id);
		return t && Reflect.apply(i.hasAttribute, i, ["disabled"]) ? !1 : ne(r.method, n);
	}, re = (t) => {
		if (typeof t != "string") return Pn;
		if (t.length > 4096) return Fn;
		if (t.trim().length === 0) return Pn;
		if (Ln.test(t)) return In;
		h();
		let n = y();
		try {
			return n.value = t, Reflect.apply(n.handleCommand, n, []), Nn;
		} catch (t) {
			throw J(e, "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED", "firefox-address-submit", "window.gURLBar.handleCommand", t);
		}
	}, ie = () => {
		let e = Jn(p());
		return K(e) && q(e.hasAttribute) && !!Reflect.apply(e.hasAttribute, e, ["data-fennevia-healthy"]);
	}, ae = (e) => {
		if (!K(e) || !K(e.sourceEvent)) return !1;
		let t = e.sourceEvent.target;
		return K(t) && t.id === "focusURLBar";
	}, oe = (e) => {
		if (!(i || a)) try {
			if (!ie() || !ae(e) || f.size === 0) return;
			M(!0);
			let t = !1;
			for (let e of Array.from(f)) t = e(Mn) === !0 || t;
			if (!t || !K(e)) return;
			q(e.preventDefault) && Reflect.apply(e.preventDefault, e, []), q(e.stopPropagation) && Reflect.apply(e.stopPropagation, e, []);
		} catch (e) {
			N(e, Bn(jn));
		}
	}, se = Object.freeze({
		back: (e) => I("back", !0, e === void 0 ? void 0 : Dn(e)),
		focusContent() {
			let t = h(), n = t.focus;
			if (!q(n)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus");
			try {
				return Reflect.apply(n, t, []), !0;
			} catch (t) {
				throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus", t);
			}
		},
		forward: (e) => I("forward", !0, e === void 0 ? void 0 : Dn(e)),
		home(e) {
			return h(), ne("home", e === void 0 ? void 0 : Dn(e));
		},
		newTab: () => I("newTab", !1),
		reload(e) {
			return e === void 0 ? I("reload") : (h(), ne("reloadOrDuplicate", Dn(e)));
		},
		reloadOrStop() {
			let e = T(On.stop.id) ? "stop" : "reload";
			return I(e), e;
		},
		snapshot() {
			return p(), s;
		},
		stop: () => I("stop"),
		submitAddress: re,
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
		for (let n of kn) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (K(e) && e.target !== m().selectedTab || !sr(e))) return;
				M(!0);
			} catch (e) {
				N(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		u.push(e.subscribe(v(jn), "command", oe));
		let n = m();
		Reflect.apply(n.addTabsProgressListener, n, [ee]), l = !0;
		let r = p().MutationObserver;
		c = new r(() => {
			P("document.command.disabled");
		});
		for (let { id: e } of Object.values(On)) c.observe(v(e), {
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
			e && q(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [ee]);
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
			if (u.length = 0, d.clear(), f.clear(), r = null, t !== void 0) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", t);
			return !0;
		},
		navigation: se,
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
var lr = Object.freeze([
	"playing",
	"muted",
	"blocked"
]), ur = Object.freeze([
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
new Set(lr);
var dr = new Set(ur);
function fr(e) {
	return typeof e == "string" && dr.has(e);
}
//#endregion
//#region src/firefox/tabs/support.ts
var pr = Object.freeze([
	"TabOpen",
	"TabClose",
	"TabSelect",
	"TabMove",
	"TabPinned",
	"TabUnpinned",
	"TabAttrModified"
]), mr = new Set([
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
]), hr = "resource://gre/modules/ContextualIdentityService.sys.mjs", gr = /[\s"'<>\\]/u, _r = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, vr = Object.freeze({
	toolbar: "gray",
	turquoise: "cyan"
}), yr = (e) => typeof e == "object" && !!e || typeof e == "function", Y = (e) => typeof e == "object" && !!e, br = (e) => typeof e == "function", xr = (e) => e.gBrowser, Sr = (e, t) => {
	let n = xr(e);
	return Y(n) ? n[t] : void 0;
}, Cr = (e, t) => {
	let n = e.document;
	if (!(!Y(n) || !br(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, wr = (e) => Y(e) && br(e.openPopup) && br(e.moveTo) && br(e.addEventListener) && br(e.removeEventListener), Tr = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => Sr(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: yr,
		name: "firefox.selected-tab",
		read: (e) => Sr(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab"
	}),
	...[
		["add-tab", "addTrustedTab"],
		["remove-tab", "removeTab"],
		["pin-tab", "pinTab"],
		["unpin-tab", "unpinTab"],
		["move-tab", "moveTabTo"]
	].map(([e, t]) => Object.freeze({
		isAvailable: br,
		name: `firefox.${e}`,
		read: (e) => Sr(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: (e) => typeof e == "string" && e.length > 0 && e.length <= 2048,
		name: "firefox.new-tab-url",
		read: (e) => e.BROWSER_NEW_TAB_URL,
		symbol: "window.BROWSER_NEW_TAB_URL"
	}),
	Object.freeze({
		isAvailable: wr,
		name: "firefox.tab-context-menu",
		read: (e) => Cr(e, "tabContextMenu"),
		symbol: "document.tabContextMenu.openPopup.moveTo"
	})
]), Er = (e) => Object.freeze(Tr.map((t) => {
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
})), Dr = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, X = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Dr(e),
	phase: n,
	symbol: r
}), Or = (e, t) => {
	if (!Y(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw X(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, kr = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !gr.test(e) || e.length <= 262144 && _r.test(e))) return e;
}, Ar = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl && e.audio === r.audio && e.attention === r.attention && e.pictureInPicture === r.pictureInPicture && e.container?.color === r.container?.color && e.container?.label === r.container?.label;
}), jr = (e) => {
	if (!Y(e) || !Y(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => mr.has(e));
}, Mr = (e) => {
	if (typeof e != "string" || e.length === 0) return;
	let t = vr[e] ?? e;
	return fr(t) ? t : void 0;
}, Nr = (e, t) => !Y(e) || e.target === void 0 || e.target === t || Y(e.target) && e.target.id === "tabContextMenu";
//#endregion
//#region src/firefox/tabs/controller.ts
function Pr({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !Y(r) || typeof n != "function") throw X(e, "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID", "firefox-tabs-create", "window");
	let i = r, a = !1, o = null, s = 0, c = Object.freeze([]), l = new Set(), u = new Set(), d = [], f = e.createHandleRegistry("tab"), p = null, m = null;
	if (typeof t == "function") try {
		let e = t(hr), n = Y(e) ? e.ContextualIdentityService : void 0;
		Y(n) && br(n.getPublicIdentityFromId) && (p = n);
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
		let t = Er(h()), n = t.find((e) => !e.snapshot.available);
		if (n) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, y = () => {
		let t = g().openTabs;
		if (!Array.isArray(t)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = t.map((t) => Or(e, t));
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
		let r = Mr(n.color);
		if (!r) return;
		let i = "";
		if (typeof n.name == "string" && (i = n.name), i.trim().length === 0 && br(p.getUserContextLabel)) try {
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
		let n = String(x(e, "label") ?? "").slice(0, 256), r = kr(x(e, "image")), i = C(e), a = w(e);
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
		return !Ar(c, i) && (c = i, s += 1, e && D(), !0);
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
		if (!Y(t) || Object.keys(t).some((e) => e !== "screenX" && e !== "screenY") || typeof t.screenX != "number" || typeof t.screenY != "number" || !Number.isFinite(t.screenX) || !Number.isFinite(t.screenY) || Math.abs(t.screenX) > 1e5 || Math.abs(t.screenY) > 1e5) throw X(e, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POINT_INVALID", "firefox-tabs-action", "tabs.openContextMenu.point");
		return Object.freeze({
			screenX: t.screenX,
			screenY: t.screenY
		});
	}, P = () => {
		if (h(), !m || !wr(m)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
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
			if (!Number.isSafeInteger(n) || n < 0 || n > 1e4) throw X(e, "FENNEVIA_FIREFOX_TAB_MOVE_INDEX_INVALID", "firefox-tabs-action", "tabs.move.index");
			j("moveTabTo", [r, {
				isUserTriggered: !0,
				tabIndex: n
			}]), O(!0);
		},
		open(t) {
			let n = M(t), r = h().BROWSER_NEW_TAB_URL;
			if (typeof r != "string" || r.length === 0) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.BROWSER_NEW_TAB_URL");
			let i = Or(e, j("addTrustedTab", [r, { inBackground: !n.selected }]));
			if (!y().includes(i)) throw X(e, "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED", "firefox-tabs-action", "window.gBrowser.addTrustedTab");
			let a = f.register(i);
			if (O(!0), n.selected && g().selectedTab !== i) throw X(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			return a;
		},
		openContextMenu(t, r) {
			let i = A(t), a = N(r), o = P(), s = o.openPopup, c = o.moveTo;
			if (!br(s) || !br(c)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
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
			if (!br(r)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "MozTabbrowserTab.toggleMuteAudio");
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
		for (let n of pr) d.push(e.subscribe(t, n, (e) => {
			if (!(a || o)) try {
				if (n === "TabAttrModified" && !jr(e)) return;
				O(!0);
			} catch (e) {
				k(e, n);
			}
		}));
		let n = Cr(h(), "tabContextMenu");
		if (!wr(n)) throw X(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "document.tabContextMenu.openPopup.moveTo");
		m = n, d.push(e.subscribe(n, "popupshown", (e) => {
			a || o || !Nr(e, n) || E(Object.freeze({
				open: !0,
				type: "context-menu"
			}));
		})), d.push(e.subscribe(n, "popuphidden", (e) => {
			a || !Nr(e, n) || E(Object.freeze({
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
			if (m && br(n)) try {
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
		tabs: F
	});
}
//#endregion
//#region src/firefox/toolbar-widgets/native-support.ts
var Fr = "nav-bar", Ir = "unified-extensions-area", Lr = "fennevia.customize.layout", Rr = "fennevia.customize.style", zr = "fennevia.customize.", Br = "after_start", Vr = Object.freeze({ capture: !0 }), Hr = /^rgba?\([0-9\s.,%]{1,48}\)$/u, Ur = /url\(\s*"((?:[^"\\]|\\.){1,512})"\s*\)/u, Wr = /url\(\s*'((?:[^'\\]|\\.){1,512})'\s*\)/u, Gr = /url\(\s*((?:[^"')\\]|\\.){1,512})\s*\)/u, Kr = "moz-extension://", qr = "-browser-action", Jr = /["'\\<>\s]/u, Yr = /#([A-Za-z_][\w-]*)/gu, Xr = /^(?:branding|browser|toolkit|preview)\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.ftl$/u, Zr = /^(?:[A-Za-z][\w-]*\.)?(?:label|tooltiptext\d*)$/u, Qr = /%[0-9$]*[Ssd]/u, $r = Object.freeze([
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
]), ei = new Set($r), ti = new Map([
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
]), ni = Object.freeze([
	"browser/browser.ftl",
	"browser/sidebar.ftl",
	"browser/appmenu.ftl",
	"browser/screenshots.ftl"
]), ri = new Map([
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
]), ii = new Map([
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
]), ai = new Map([["show-bookmarks", Object.freeze({
	icon: "bookmark",
	label: "Show bookmarks panel",
	tooltip: "Reveal the Fennevia bookmarks panel"
})], ["show-downloads", Object.freeze({
	icon: "download",
	label: "Open Firefox downloads",
	tooltip: "Open the Firefox downloads panel"
})]]), Z = (e) => typeof e == "object" && !!e, Q = (e) => typeof e == "function", oi = (e) => Z(e) && Q(e.getAttribute), si = (e) => Z(e) && Q(e.hidePopup) && Q(e.moveToAnchor), ci = (e, t) => typeof e == "string" ? e.slice(0, t) : "", li = (e) => {
	let t = e.trim();
	return Hr.test(t) ? t : "";
}, ui = (e) => {
	let t = e.CustomizableUI;
	return !Z(t) || !Q(t.getWidgetIdsInArea) || !Q(t.getWidget) || !Q(t.addListener) || !Q(t.removeListener) ? null : t;
}, di = (e) => {
	let t = e.Services;
	if (!Z(t)) return null;
	let n = t.prefs;
	return !Z(n) || !Q(n.addObserver) || !Q(n.clearUserPref) || !Q(n.getStringPref) || !Q(n.removeObserver) || !Q(n.setStringPref) ? null : n;
}, fi = (e, t) => {
	try {
		let n = Reflect.apply(e.getStringPref, e, [t, ""]);
		return typeof n == "string" && n.length <= 16384 ? n : "";
	} catch {
		return "";
	}
}, pi = (e) => {
	try {
		let t = e.AREA_ADDONS;
		return typeof t == "string" && t !== "" ? t : Ir;
	} catch {
		return Ir;
	}
}, mi = (e, t) => {
	if (Q(e.isWebExtensionWidget)) try {
		return Reflect.apply(e.isWebExtensionWidget, e, [t]) === !0;
	} catch {}
	return t.endsWith(qr);
}, hi = (e) => {
	let t = e.PanelUI;
	return !Z(t) || !Q(t.showSubView) ? null : t.showSubView;
}, gi = Object.freeze([
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.customizable-ui",
		read: (e) => ui(e),
		requirement: "optional",
		symbol: "window.CustomizableUI.getWidgetIdsInArea.getWidget.addListener.removeListener"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.panel-ui-sub-view",
		read: (e) => hi(e),
		requirement: "optional",
		symbol: "window.PanelUI.showSubView"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.prefs",
		read: (e) => di(e),
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
]), _i = (e) => Object.freeze(gi.map((t) => {
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
})), vi = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, $ = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: vi(e),
	phase: n,
	symbol: r
}), yi = (e) => {
	if (e.startsWith("customizableui-special-")) {
		let t = /^customizableui-special-(spring|spacer|separator)/u.exec(e);
		return t ? t[1] : null;
	}
	return e === "spring" || e === "spacer" || e === "separator" ? e : e === "vertical-spacer" ? "spacer" : null;
}, bi = (e, t) => {
	if (!e) return "";
	try {
		let n = e[t];
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, xi = (e, t) => {
	let n = e.document;
	if (!(!Z(n) || !Q(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Si = (e, t) => {
	if (Q(e.querySelector)) try {
		return Reflect.apply(e.querySelector, e, [t]);
	} catch {
		return;
	}
}, Ci = (e, t) => {
	try {
		let n = Reflect.apply(e.getAttribute, e, [t]);
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, wi = (e) => {
	if (e === "" || e === "none") return "";
	let t = Ur.exec(e);
	if (t) return t[1].replace(/\\(.)/gu, "$1");
	let n = Wr.exec(e);
	if (n) return n[1].replace(/\\(.)/gu, "$1");
	let r = Gr.exec(e);
	return r ? r[1].replace(/\\(.)/gu, "$1") : "";
}, Ti = (e, t) => e === "" || e.length > 512 || Jr.test(e) ? !1 : t === "extension" ? e.startsWith(Kr) : e.startsWith("chrome://") || e.startsWith("resource://"), Ei = (e) => {
	if (oi(e)) return e;
	if (Array.isArray(e)) {
		let t = e[0];
		return oi(t) ? t : null;
	}
	if (!Z(e)) return null;
	let t = e[0];
	if (oi(t)) return t;
	if (Q(e.item)) try {
		let t = Reflect.apply(e.item, e, [0]);
		return oi(t) ? t : null;
	} catch {
		return null;
	}
	return null;
}, Di = (e) => {
	if (!Z(e)) return "";
	try {
		let t = e.listStyleImage;
		if (typeof t == "string" && t !== "") {
			let e = wi(t);
			if (e) return e;
		}
	} catch {}
	if (Q(e.getPropertyValue)) try {
		let t = Reflect.apply(e.getPropertyValue, e, ["list-style-image"]);
		if (typeof t == "string") return wi(t);
	} catch {
		return "";
	}
	return "";
}, Oi = (e) => {
	try {
		let t = e.style, n = Di(t);
		if (n) return n;
	} catch {}
	return "";
}, ki = (e) => {
	if (typeof e != "string" || e === "") return [];
	let t = [];
	Yr.lastIndex = 0;
	for (let n of e.matchAll(Yr)) {
		let e = n[1];
		e && t.push(e);
	}
	return t;
}, Ai = (e, t, n = []) => {
	if (!Z(e)) return;
	let r;
	try {
		r = e.selectorText;
	} catch {
		r = void 0;
	}
	let i = ki(r), a = i.length > 0 ? i : n, o = Oi(e);
	if (o && Ti(o, "builtin")) for (let e of a) t.set(e, o);
	let s;
	try {
		s = e.cssRules;
	} catch {
		s = void 0;
	}
	if (Z(s) && typeof s.length == "number") {
		let e = s.length;
		for (let n = 0; n < e; n += 1) Ai(s[n], t, a);
	}
}, ji = (e, t) => {
	if (Array.isArray(e) || Z(e)) return e[t];
}, Mi = (e, t) => {
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
}, Ni = (e, t) => {
	let n = ji(e, 0);
	if (!Z(n)) return "";
	let r = Mi(n.attributes, "label") || Mi(n.attributes, "tooltiptext"), i = typeof n.value == "string" ? n.value : "", a = r || i;
	return !a || a === t ? "" : ci(a, 200);
}, Pi = (e, t) => {
	if (Q(e.formatMessagesSync)) try {
		let n = Ni(Reflect.apply(e.formatMessagesSync, e, [[{ id: t }]]), t);
		if (n) return n;
	} catch {}
	if (!Q(e.formatValueSync)) return "";
	try {
		let n = Reflect.apply(e.formatValueSync, e, [t]);
		return typeof n != "string" || n === "" || n === t ? "" : ci(n, 200);
	} catch {
		return "";
	}
}, Fi = (e) => e.length > 0 && e.length <= 128 && !e.includes("..") && Xr.test(e), Ii = (e) => {
	let t = [], n = new Set(), r = (e) => {
		let r = e.trim();
		n.has(r) || !Fi(r) || t.length >= 48 || (n.add(r), t.push(r));
	};
	for (let e of ni) r(e);
	if (!Q(e.querySelectorAll)) return t;
	try {
		let t = Reflect.apply(e.querySelectorAll, e, ["link[rel=\"localization\"]"]), n = Array.isArray(t) || Z(t) && typeof t.length == "number" ? t.length : 0;
		for (let e = 0; e < n; e += 1) {
			let n = ji(t, e);
			oi(n) && r(Ci(n, "href"));
		}
	} catch {}
	return t;
}, Li = (e, t = "") => t && (e === t || e.startsWith(`${t}.`)) ? !0 : Zr.test(e), Ri = (e, t, n = "") => !e || Li(e, n) || Qr.test(e) ? "" : ci(e, t), zi = (e) => e.isConnected === !0, Bi = (e) => {
	let t = Si(e, ".unified-extensions-item-action-button");
	return oi(t) ? t : null;
}, Vi = (e) => {
	let t = "", n = e.style;
	if (Z(n) && Q(n.getPropertyValue)) try {
		let e = Reflect.apply(n.getPropertyValue, n, ["--webextension-toolbar-image"]);
		typeof e == "string" && (t = e);
	} catch {
		t = "";
	}
	t ||= Ci(e, "style");
	let r = wi(t);
	return Ti(r, "extension") ? r : "";
}, Hi = (e) => {
	let t = ci(Ci(e, "badge"), 8), n = "", r = "", i = Ci(e, "badgeStyle"), a = /background-color:\s*([^;]{1,64})/u.exec(i);
	a && (n = li(a[1]));
	let o = /(?:^|;)\s*color:\s*([^;]{1,64})/u.exec(i);
	return o && (r = li(o[1])), Object.freeze({
		background: n,
		text: t,
		textColor: r
	});
}, Ui = (e) => {
	let t = Si(e, ".unified-extensions-item-name");
	if (Z(t) && typeof t.textContent == "string") {
		let e = t.textContent.trim();
		if (e) return ci(e, 200);
	}
	return "";
}, Wi = (e) => e.disabled === !0 || Ci(e, "disabled") === "true";
//#endregion
//#region src/firefox/toolbar-widgets/popup-actions.ts
function Gi({ boundary: e, getWindowOrNull: t, isDisposed: n, onActionDelta: r, popupListeners: i, registry: a, requireProjectHost: o, requireWindow: s }) {
	let c = null, l = "", u = null, d = "", f = null, p = (e) => {
		let t = Object.freeze({
			open: e,
			type: "widget-popup"
		});
		for (let e of Array.from(i)) e(t);
	}, m = (e) => {
		let n = u;
		if (!n) return;
		u = null;
		let r = t();
		if (r && Q(r.clearTimeout)) try {
			Reflect.apply(r.clearTimeout, r, [n.timeoutHandle]);
		} catch {}
		n.resolve(e);
	}, h = (e) => {
		let n = f;
		if (!n) return;
		f = null;
		let r = t();
		if (n.timeoutHandle !== void 0 && r && Q(r.clearTimeout)) try {
			Reflect.apply(r.clearTimeout, r, [n.timeoutHandle]);
		} catch {}
		n.resolve(e);
	}, g = (e, t) => {
		c = e, l = t, p(!0);
	}, v = () => {
		c && (c = null, l = "", p(!1));
	}, y = (e) => Z(e) ? Z(e.originalTarget) ? e.originalTarget : Z(e.target) ? e.target : null : null, b = (e, t) => {
		if (t === e) return !0;
		if (!Q(e.contains)) return !1;
		try {
			return Reflect.apply(e.contains, e, [t]) === !0;
		} catch {
			return !1;
		}
	}, x = (e) => {
		if (n()) return;
		let t = y(e);
		if (!t || !si(t)) return;
		let r = typeof t.id == "string" ? t.id : "";
		if (u && r === "customizationui-widget-panel") {
			let e = d;
			m(!0), d = "", g(t, e);
			return;
		}
		if (f) {
			let e = t.anchorNode;
			if (b(f.node, e)) {
				let { handle: e, host: n } = f;
				try {
					Reflect.apply(t.moveToAnchor, t, [
						n,
						Br,
						0,
						0
					]);
				} catch {}
				g(t, e), h(!0);
			}
		}
	}, S = (e) => {
		if (n()) return;
		let t = y(e);
		if (!t) return;
		if (c && t === c) {
			v();
			return;
		}
		let r = typeof t.id == "string" ? t.id : "";
		u && r === "customizationui-widget-panel" && (m(!1), d = "");
	}, C = (e) => {
		let t = s();
		return m(!1), new Promise((n) => {
			let r = {
				resolve: n,
				timeoutHandle: void 0
			};
			u = r, d = e;
			let i = () => {
				u === r && (u = null, d = "", n(!1));
			}, a = t.setTimeout;
			Q(a) ? r.timeoutHandle = Reflect.apply(a, t, [i, 800]) : queueMicrotask(i);
		});
	}, w = (e, t, n) => {
		let r = s();
		return h(!1), new Promise((i) => {
			let a = {
				handle: e,
				host: t,
				node: n,
				resolve: i,
				timeoutHandle: void 0
			};
			f = a;
			let o = () => {
				f === a && (f = null, i(!1));
			}, s = r.setTimeout;
			Q(s) ? a.timeoutHandle = Reflect.apply(s, r, [o, 800]) : queueMicrotask(o);
		});
	}, T = () => {
		let e = c;
		if (e) try {
			Reflect.apply(e.hidePopup, e, []);
		} catch {
			v();
		}
	}, E = (t) => {
		if (Q(t.doCommand)) try {
			Reflect.apply(t.doCommand, t, []);
			return;
		} catch {}
		let n = s().CustomEvent;
		if (!Q(n) || !Q(t.dispatchEvent)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command");
		let r = Reflect.construct(n, ["command", Object.freeze({
			bubbles: !0,
			cancelable: !0
		})]);
		Reflect.apply(t.dispatchEvent, t, [r]);
	}, D = (e) => {
		let t = ui(s()), n = typeof e.id == "string" ? e.id : "";
		if (!t || !n) return "";
		try {
			let e = Reflect.apply(t.getWidget, t, [n]);
			if (Z(e) && typeof e.viewId == "string") return e.viewId;
		} catch {
			return "";
		}
		return "";
	};
	return Object.freeze({
		dispose() {
			let e = c;
			if (m(!1), d = "", h(!1), c = null, l = "", e) try {
				Reflect.apply(e.hidePopup, e, []);
			} catch {}
		},
		invoke: async (t, n) => {
			if (typeof t != "string" || t === "") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.handle");
			let i = o(n), u = a.resolve(t);
			if (!zi(u)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE", "firefox-toolbar-widgets-action", "toolbar-widgets.native-node");
			r(1);
			try {
				if (c && l === t) return T(), !0;
				T();
				let n = s(), r = D(u), a = hi(n);
				if (r && a) {
					try {
						i.open === !0 && (i.open = !1);
					} catch {}
					let o = C(t);
					try {
						let e = Reflect.apply(a, n.PanelUI, [r, i]);
						Promise.resolve(e).catch(() => {});
					} catch (t) {
						throw m(!1), d = "", $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.PanelUI.showSubView", t);
					}
					return await o;
				}
				let o = w(t, i, u);
				try {
					E(u);
				} catch (t) {
					throw h(!1), _(t) ? t : $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command", t);
				}
				return await o;
			} finally {
				r(-1);
			}
		},
		onPopupHidden: S,
		onPopupShown: x
	});
}
//#endregion
//#region src/firefox/toolbar-widgets/controller.ts
function Ki({ boundary: e, frame: t, window: n }) {
	if (e.assertOwnsWindow(n), !Z(n) || !Z(t) || typeof t.contains != "function") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_OPTIONS_INVALID", "firefox-toolbar-widgets-create", "window");
	let r = (e) => Reflect.apply(t.contains, t, [e]) === !0, i = n, a = !1, o = 0, s = 0, c = !1, l = !1, u = !1, d = "", f = st(), p = null, m = Qe(), h = 0, g = new Map(), v = new Map(), y = null, b = null, x, S = new Set(), C = [], w = new Set(), T = new Set(), E = e.createHandleRegistry("toolbar-widget"), D = () => {
		if (a || !i) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_DISPOSED", "firefox-toolbar-widgets-access", "window");
		return i;
	}, O = () => {
		let t = _i(D()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, k = Gi({
		boundary: e,
		getWindowOrNull: () => i,
		isDisposed: () => a,
		onActionDelta(e) {
			o += e;
		},
		popupListeners: T,
		registry: E,
		requireProjectHost: (t) => {
			let n = D();
			if (!Z(t) || !Q(t.getBoundingClientRect) || t.ownerDocument !== n.document || r(t) !== !0) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HOST_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.host");
			return t;
		},
		requireWindow: D
	}), { invoke: A, onPopupHidden: j, onPopupShown: M } = k, N = e.snapshot().windowKind === "private", P = (e, t) => {
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
			return Ei(Reflect.apply(r.getElementsByAttribute, r, ["id", e]));
		} catch {
			return null;
		}
	}, ee = (e) => {
		let t = i;
		if (!t) return null;
		let n = xi(t, e);
		return oi(n) ? n : F(e);
	}, te = () => {
		if (x !== void 0) return x;
		x = null;
		let e = i;
		if (!e || !Q(e.Localization)) return null;
		let t = e.document, n = Z(t) ? Ii(t) : [...ni];
		try {
			let t = Reflect.construct(e.Localization, [n, !0]);
			return !Z(t) || !Q(t.formatMessagesSync) && !Q(t.formatValueSync) ? null : (x = t, t);
		} catch {
			return null;
		}
	}, ne = (e) => {
		if (!e) return "";
		let t = te();
		if (t) {
			let n = Pi(t, e);
			if (n) return n;
		}
		let n = i;
		if (!n) return "";
		let r = n.document;
		if (!Z(r)) return "";
		let a = r.l10n;
		return Z(a) ? Pi(a, e) : "";
	}, I = (e, t, n) => {
		if (!Q(e.getLocalizedProperty)) return "";
		try {
			let r = Reflect.apply(e.getLocalizedProperty, e, [t, n]);
			return typeof r != "string" || r === "" ? "" : Ri(r, 200, t);
		} catch {
			return "";
		}
	}, re = (e, t, n, r, i) => {
		let a = r ? Ri(Ci(r, "label") || bi(r, "label"), 200, t) : "", o = r ? Ri(Ci(r, "title") || bi(r, "title"), 200, t) : "", s = r ? Ri(Ci(r, "tooltiptext") || bi(r, "tooltiptext"), 200, t) : "", c = Ri(bi(n, "label"), 200, t), l = Ri(bi(n, "tooltiptext"), 200, t), u = r ? ne(Ci(r, "data-l10n-id")) : "", d = ne(ri.get(t) ?? "");
		return a || o || c || u || I(e, t, "label") || d || s || l || I(e, t, "tooltiptext") || (i ? "Extension" : "Toolbar item");
	}, ie = (e, t, n, r) => {
		let i = n ? Ri(Ci(n, "tooltiptext") || bi(n, "tooltiptext"), 300, e) : "", a = n ? Ri(Ci(n, "title") || bi(n, "title"), 300, e) : "", o = Ri(bi(t, "tooltiptext"), 300, e);
		return i || a || o || r;
	}, ae = () => {
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
			for (let t = 0; t < a; t += 1) Ai(i[t], e);
		}
		return e;
	}, oe = (e) => (b ||= ae(), b.get(e) ?? ""), se = (e) => {
		let t = i;
		if (!t || !Q(t.getComputedStyle)) return "";
		let n = [e], r = Si(e, "toolbarbutton");
		oi(r) && n.unshift(r);
		for (let e of n) try {
			let n = Di(Reflect.apply(t.getComputedStyle, t, [e]));
			if (Ti(n, "builtin")) return n;
		} catch {}
		return "";
	}, ce = (e, t) => {
		if (t) {
			let e = se(t);
			if (e) return e;
		}
		let n = oe(e);
		if (n) return n;
		let r = ii.get(e) ?? "";
		return Ti(r, "builtin") ? r : "";
	}, le = (e) => Object.freeze({
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
	}), ue = (e) => {
		let t = ai.get(e);
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
	}, de = (e, t) => {
		let n = P(e, t), r = n?.webExtension === !0 || mi(e, t), i = ee(t), a = re(e, t, n, i, r), o = "";
		if (r && i) {
			let e = Bi(i);
			o = e ? Vi(e) : "";
		} else r || (o = ce(t, i));
		return Object.freeze({
			badgeBackground: "",
			badgeText: "",
			badgeTextColor: "",
			disabled: !0,
			fenneviaAction: "",
			handle: "",
			icon: r ? "extension" : ti.get(t) ?? "generic",
			iconUrl: o,
			kind: r ? "extension-action" : "built-in",
			label: a,
			missing: !0,
			tooltip: ie(t, n, i, a)
		});
	}, fe = (e, t) => {
		let n = xi(D(), t);
		if (!oi(n) || !zi(n)) return Object.freeze({
			node: null,
			widget: de(e, t)
		});
		let r = P(e, t), i = r?.webExtension === !0 || mi(e, t), a = E.register(n);
		if (i) {
			let i = Bi(n), o = i ? Hi(i) : Object.freeze({
				background: "",
				text: "",
				textColor: ""
			}), s = Ui(n) || re(e, t, r, n, !0);
			return Object.freeze({
				node: n,
				widget: Object.freeze({
					badgeBackground: o.background,
					badgeText: o.text,
					badgeTextColor: o.textColor,
					disabled: Wi(i || n),
					fenneviaAction: "",
					handle: a,
					icon: "extension",
					iconUrl: i ? Vi(i) : "",
					kind: "extension-action",
					label: s,
					missing: !1,
					tooltip: ie(t, r, n, s)
				})
			});
		}
		let o = re(e, t, r, n, !1);
		return Object.freeze({
			node: n,
			widget: Object.freeze({
				badgeBackground: "",
				badgeText: "",
				badgeTextColor: "",
				disabled: Wi(n),
				fenneviaAction: "",
				handle: a,
				icon: ti.get(t) ?? "generic",
				iconUrl: ce(t, n),
				kind: "built-in",
				label: o,
				missing: !1,
				tooltip: ie(t, r, n, o)
			})
		});
	}, L = (e, t) => t.type === "special" ? Object.freeze({
		node: null,
		widget: le(t.kind)
	}) : t.type === "fennevia" ? Object.freeze({
		node: null,
		widget: ue(t.id)
	}) : fe(e, t.id), pe = (e) => {
		let t;
		try {
			t = Reflect.apply(e.getWidgetIdsInArea, e, [Fr]);
		} catch {
			t = null;
		}
		let n = [];
		if (Array.isArray(t)) for (let e of t) {
			if (typeof e != "string" || ei.has(e)) continue;
			let t = yi(e);
			if (t) {
				n.push(Object.freeze({
					kind: t,
					type: "special"
				}));
				continue;
			}
			gt(e) && n.push(Object.freeze({
				id: e,
				type: "widget"
			}));
		}
		return xt({ top: n });
	}, me = (e) => {
		let t = g.get(e);
		if (t) return t;
		let n = `palette-${++h}`;
		return g.set(e, n), n;
	}, he = (e) => {
		let t;
		try {
			t = e.areas;
		} catch {
			t = void 0;
		}
		let n = Array.isArray(t) ? t : [Fr], r = [], i = new Set();
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
	}, R = (e) => {
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
		if (ei.has(t) || yi(t) !== null || !gt(t)) return null;
		let n = P(e, t);
		if (N && n?.showInPrivateBrowsing === !1) return null;
		let r = n?.webExtension === !0 || mi(e, t), i = ee(t), a = oi(i) && zi(i) ? i : null, o, s;
		if (r) {
			let r = a ? Bi(a) : i ? Bi(i) : null;
			s = r ? Vi(r) : "", o = (a ? Ui(a) : "") || re(e, t, n, i, !0);
		} else o = re(e, t, n, i, !1), s = ce(t, i);
		let c = me(`w:${t}`);
		return v.set(c, Object.freeze({
			id: t,
			type: "widget"
		})), Object.freeze({
			icon: r ? "extension" : ti.get(t) ?? "generic",
			iconUrl: s,
			kind: r ? "extension-action" : "built-in",
			label: o,
			token: c
		});
	}, ge = (e, t) => {
		v.clear();
		let n = [], r = new Set(), i = new Set();
		for (let e of Ne) for (let n of t.zones[e]) n.type === "widget" ? r.add(n.id) : n.type === "fennevia" && i.add(n.id);
		for (let e of Pe) {
			if (i.has(e)) continue;
			let t = ai.get(e), r = me(`f:${e}`);
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
		let a = [...he(e), ...R(e)], o = new Set();
		for (let t of a) {
			if (o.has(t) || r.has(t) || n.length >= 256) continue;
			o.add(t);
			let i = z(e, t);
			i && n.push(i);
		}
		for (let [e, t] of [
			["separator", "Separator"],
			["spacer", "Space"],
			["spring", "Flexible space"]
		]) {
			let r = me(`s:${e}`);
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
	}, _e = (e) => {
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
	}, ve = () => {
		let e = D(), t = ui(e);
		if (!t) return v.clear(), _e([]), Object.freeze({
			serialized: "unavailable",
			snapshot: st()
		});
		let n = p ?? pe(t), r = [], i = [], a = new Set();
		for (let e of Ne) {
			let o = [];
			for (let r of n.zones[e]) {
				let e = L(t, r);
				o.push(e.widget), i.push(e.node), e.widget.handle !== "" && a.add(e.widget.handle);
			}
			r.push([e, Object.freeze(o)]);
		}
		for (let e of S) if (!a.has(e)) try {
			E.release(e);
		} catch {}
		S.clear();
		for (let e of a) S.add(e);
		_e(i);
		let o = di(e), s = Object.freeze({
			available: !0,
			canEdit: o !== null,
			layoutCustomized: p !== null,
			palette: ge(t, n),
			style: it(m),
			zones: Object.freeze(Object.fromEntries(r))
		});
		return Object.freeze({
			serialized: JSON.stringify(s),
			snapshot: s
		});
	}, B = () => {
		if (a) return;
		let e = ve();
		if (e.serialized === d) return;
		d = e.serialized, f = e.snapshot, s += 1;
		let t = Object.freeze({
			revision: s,
			snapshot: f,
			type: "snapshot"
		});
		for (let e of Array.from(w)) e(t);
	}, V = () => {
		if (a || c) return;
		c = !0;
		let e = () => {
			c = !1, !a && B();
		}, t = i, n = t?.setTimeout;
		if (t && Q(n)) {
			Reflect.apply(n, t, [e, 0]);
			return;
		}
		queueMicrotask(e);
	}, ye = Object.freeze({
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
	}), be = () => {
		if (!l) return;
		l = !1;
		let e = i;
		if (!e) return;
		let t = ui(e);
		if (t) try {
			Reflect.apply(t.removeListener, t, [ye]);
		} catch {}
	}, H = () => {
		let e = i;
		if (!e) return;
		let t = di(e);
		if (!t) {
			p = null, m = Qe();
			return;
		}
		p = St(fi(t, Lr)), m = wt(fi(t, "fennevia.customize.style")) ?? Qe();
	}, xe = Object.freeze({ observe: () => {
		a || (H(), V());
	} }), U = () => {
		if (!u) return;
		u = !1;
		let e = i, t = e ? di(e) : null;
		if (t) try {
			Reflect.apply(t.removeObserver, t, [zr, xe]);
		} catch {}
	}, Se = () => {
		let t = di(D());
		if (!t) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.Services.prefs");
		return t;
	}, Ce = (e) => {
		let t = Se();
		Reflect.apply(t.setStringPref, t, [Lr, Ct(e)]), p = e;
	}, we = (e) => {
		let t = Se();
		Reflect.apply(t.setStringPref, t, [Rr, Tt(e)]), m = e;
	}, W = (t, n, r) => {
		let i = "";
		if (Q(t.getPlacementOfWidget)) try {
			let e = Reflect.apply(t.getPlacementOfWidget, t, [r]);
			Z(e) && typeof e.area == "string" && (i = e.area);
		} catch {
			i = "";
		}
		if (i !== "" && i !== pi(t)) return n;
		if (!Q(t.addWidgetToArea)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI.addWidgetToArea");
		return Reflect.apply(t.addWidgetToArea, t, [r, Fr]), Pt(n, r);
	}, Te = (e, t, n) => {
		if (!t.adopted.includes(n)) return t;
		if (mi(e, n)) {
			if (Q(e.addWidgetToArea)) try {
				Reflect.apply(e.addWidgetToArea, e, [n, pi(e)]);
			} catch {}
		} else if (Q(e.removeWidgetFromArea)) try {
			Reflect.apply(e.removeWidgetFromArea, e, [n]);
		} catch {}
		return Ft(t, n);
	}, Ee = () => {
		let t = ui(D());
		if (!t) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI");
		return t;
	}, De = Object.freeze({
		edit: async (t) => {
			D();
			let n;
			try {
				n = ut(t);
			} catch (t) {
				throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
			}
			o += 1;
			try {
				if (n.type === "set-style") return we(it({
					...m,
					...n.style
				})), B(), !0;
				if (n.type === "reset-style") {
					let e = Se();
					try {
						Reflect.apply(e.clearUserPref, e, [Rr]);
					} catch {}
					return m = Qe(), B(), !0;
				}
				let t = Ee();
				if (Se(), n.revision !== s) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_STALE", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit-revision");
				let r = p ?? pe(t);
				try {
					switch (n.type) {
						case "add": {
							let i = v.get(n.token);
							if (!i) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.palette-token");
							let a = r;
							i.type === "widget" && (a = W(t, a, i.id)), a = At(a, i, n.zone, n.index), Ce(a);
							break;
						}
						case "move":
							Ce(Nt(r, n.fromZone, n.fromIndex, n.toZone, n.toIndex));
							break;
						case "remove": {
							let e = Mt(r, n.zone, n.index), i = jt(r, n.zone, n.index);
							e.type === "widget" && !It(i, e.id) && (i = Te(t, i, e.id)), Ce(i);
							break;
						}
						case "reset-layout": {
							let e = r;
							for (let n of [...r.adopted]) e = Te(t, e, n);
							let n = Se();
							try {
								Reflect.apply(n.clearUserPref, n, [Lr]);
							} catch {}
							p = null;
							break;
						}
					}
				} catch (t) {
					throw _(t) ? t : $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_FAILED", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
				}
				return B(), !0;
			} finally {
				--o;
			}
		},
		invoke: A,
		snapshot() {
			D();
			let e = ve();
			return d = e.serialized, f = e.snapshot, f;
		},
		subscribe(t) {
			if (D(), typeof t != "function") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			w.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, w.delete(t), !0) : !1);
		},
		subscribePopup(t) {
			if (D(), typeof t != "function") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			T.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, T.delete(t), !0) : !1);
		}
	});
	try {
		O();
		let t = D().document;
		C.push(e.subscribe(t, "popupshown", M, Vr), e.subscribe(t, "popuphidden", j, Vr));
		let n = ui(D());
		n && (Reflect.apply(n.addListener, n, [ye]), l = !0);
		let r = di(D());
		r && (Reflect.apply(r.addObserver, r, [zr, xe]), u = !0), H();
		let i = ve();
		d = i.serialized, f = i.snapshot;
	} catch (e) {
		a = !0, U(), x = null, i = null;
		for (let e of C.reverse()) try {
			e();
		} catch {}
		throw C.length = 0, e;
	}
	return Object.freeze({
		assertRequiredCapabilities: O,
		dispose() {
			if (a) return !1;
			if (a = !0, k.dispose(), be(), U(), Z(y) && Q(y.disconnect)) try {
				Reflect.apply(y.disconnect, y, []);
			} catch {}
			y = null, w.clear(), T.clear(), S.clear(), g.clear(), v.clear(), b = null, x = null, E.dispose(), i = null;
			for (let e of C.reverse()) try {
				e();
			} catch {}
			return C.length = 0, !0;
		},
		refresh() {
			return !a && (B(), !0);
		},
		snapshot() {
			return Object.freeze({
				disposed: a,
				pendingActionCount: o,
				revision: s,
				widgetCount: Ne.reduce((e, t) => e + f.zones[t].length, 0)
			});
		},
		toolbarWidgets: De
	});
}
//#endregion
//#region src/app/urlbar-coverage-state.ts
var qi = Object.freeze([
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
]), Ji = Object.freeze([
	"location",
	"media",
	"serial",
	"xr"
]), Yi = Object.freeze([
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
new Set(qi), new Set(Ji), new Set(Yi);
//#endregion
//#region src/firefox/urlbar-coverage/support.ts
var Xi = Object.freeze([
	"blocked-permissions-container",
	"identity-permission-box",
	"page-action-buttons"
]), Zi = Object.freeze({
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
}), Qi = Object.freeze([
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
]), $i = Object.freeze([
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
]), ea = new Set([
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
]), ta = (e) => typeof e == "object" && !!e, na = (e) => typeof e == "function", ra = (e) => ta(e) && na(e.getAttribute) && na(e.hasAttribute), ia = (e) => ta(e) && na(e.getElementById), aa = (e) => ia(e.document) ? e.document : null, oa = (e, t) => {
	let n = aa(e);
	return n ? Reflect.apply(n.getElementById, n, [t]) : void 0;
}, sa = (e) => aa(e)?.documentElement, ca = Object.freeze([
	Object.freeze({
		isAvailable: na,
		name: "firefox.urlbar-coverage-native-access",
		read: (e) => e.openLocation,
		symbol: "window.openLocation"
	}),
	Object.freeze({
		isAvailable: na,
		name: "firefox.urlbar-coverage-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: ra,
		name: "firefox.urlbar-coverage-urlbar-state",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.hasAttribute"
	}),
	Object.freeze({
		isAvailable: ra,
		name: "firefox.urlbar-coverage-window-state",
		read: sa,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Xi.map((e) => Object.freeze({
		isAvailable: ra,
		name: `firefox.urlbar-coverage-${e}`,
		read: (t) => oa(t, e),
		symbol: `document.elements[${e}]`
	}))
]), la = (e, t) => Object.freeze([...ca.map((t) => {
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
	available: na(t),
	name: "firefox.urlbar-coverage-native-ui-handoff",
	requirement: "required",
	symbol: "nativeUi.revealForUrlbar"
}) })]), ua = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, da = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: ua(e),
	phase: n,
	symbol: r
}), fa = (e, t) => {
	let n = Reflect.apply(e.getAttribute, e, [t]);
	return typeof n == "string" ? n : null;
}, pa = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), ma = (e) => {
	if (e.hidden === !0) return !1;
	let t = fa(e, "hidden");
	return t !== null && t !== "false" ? !1 : fa(e, "collapsed") !== "true";
}, ha = (e) => {
	let t = e.children;
	return Object.freeze(!t || typeof t != "object" && !Array.isArray(t) ? [] : Array.from(t));
}, ga = (e, t) => {
	let n = e.classList;
	return ta(n) && na(n.contains) && !!Reflect.apply(n.contains, n, [t]);
}, _a = (e, t) => e.permissions.available === t.permissions.available && e.permissions.hasPermissions === t.permissions.hasPermissions && e.permissions.blocked.length === t.permissions.blocked.length && e.permissions.blocked.every((e, n) => e === t.permissions.blocked[n]) && e.permissions.sharing.length === t.permissions.sharing.length && e.permissions.sharing.every((e, n) => e === t.permissions.sharing[n]) && e.items.length === t.items.length && e.items.every((e, n) => e === t.items[n]);
//#endregion
//#region src/firefox/urlbar-coverage/controller.ts
function va({ boundary: e, onError: t, requestNativeUiReveal: n, window: r }) {
	if (e.assertOwnsWindow(r), !ta(r) || typeof t != "function" || typeof n != "function") throw da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_OPTIONS_INVALID", "firefox-urlbar-coverage-create", "window");
	let i = r, a = !1, o = null, s = 0, c = null, l = Object.freeze({
		items: Object.freeze([]),
		permissions: Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		})
	}), u = new Set(), d = () => {
		if (a || !i) throw da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSED", "firefox-urlbar-coverage-access", "window.gURLBar");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, f = (t) => {
		let n = oa(d(), t);
		if (!ra(n)) throw da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", `document.elements[${t}]`);
		return n;
	}, p = () => {
		let t = d().gURLBar;
		if (!ra(t)) throw da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "window.gURLBar.hasAttribute");
		return t;
	}, m = () => {
		let t = sa(d());
		if (!ra(t)) throw da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "document.documentElement.hasAttribute");
		return t;
	}, h = () => {
		let t = la(d(), n), r = t.find((e) => !e.snapshot.available);
		if (r) throw da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-capability", r.snapshot.symbol, r.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, g = () => {
		let e = p(), t = f("identity-permission-box"), n = Object.freeze(Qi.flatMap(({ id: e, kind: t }) => {
			let n = oa(d(), e);
			return ra(n) && pa(n, "sharing") ? [t] : [];
		}));
		if (!(fa(e, "pageproxystate") === "valid" || pa(e, "persistsearchterms") || n.length > 0)) return Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		});
		let r = Object.freeze(ha(f("blocked-permissions-container")).flatMap((e) => {
			if (!ra(e) || !pa(e, "showing")) return [];
			let t = fa(e, "data-permission-id"), n = t ? Zi[t] : void 0;
			return n ? [n] : [];
		}));
		return Object.freeze({
			available: !0,
			blocked: r,
			hasPermissions: pa(t, "hasPermissions"),
			sharing: n
		});
	}, v = () => {
		let e = d(), t = p(), n = new Set();
		pa(m(), "remotecontrol") && n.add("remote-control"), pa(t, "searchmode") && n.add("search-mode"), pa(t, "persistsearchterms") && n.add("persisted-search");
		for (let { id: t, kind: r } of $i) {
			let i = oa(e, t);
			ra(i) && ma(i) && n.add(r);
		}
		let r = oa(e, "pageActionButton");
		ra(r) && pa(r, "multiple-children") && n.add("more-page-actions");
		for (let e of ha(f("page-action-buttons"))) {
			if (!ra(e) || !ma(e) || !ga(e, "urlbar-page-action")) continue;
			let t = typeof e.id == "string" ? e.id : "";
			ea.has(t) || (ga(e, "urlbar-addon-page-action") ? n.add("extension-actions") : pa(e, "actionid") && n.add("other-page-actions"));
		}
		return Object.freeze(Yi.filter((e) => n.has(e)));
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
			t(da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED", "firefox-urlbar-coverage-notify", "urlbarCoverage.subscribe", n));
		}
	}, S = (e) => {
		let t = y();
		return _a(l, t) && s > 0 ? !1 : (l = t, s += 1, e && x(), !0);
	}, C = (n) => {
		o = _(n) ? n : da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_EVENT_FAILED", "firefox-urlbar-coverage-event", "window.MutationObserver", n), t(o);
	}, w = Object.freeze({
		openNativeUrlbar() {
			let t = d(), r = t.openLocation;
			if (!na(r)) throw da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-native-access", "window.openLocation");
			try {
				if (n() !== !0) throw da(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_UI_HANDOFF_REJECTED", "firefox-urlbar-native-access", "nativeUi.revealForUrlbar");
				return Reflect.apply(r, t, []), !0;
			} catch (t) {
				throw _(t) ? t : da(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_ACCESS_FAILED", "firefox-urlbar-native-access", "window.openLocation", t);
			}
		},
		snapshot() {
			return d(), l;
		},
		subscribe(t) {
			if (d(), typeof t != "function") throw da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_LISTENER_INVALID", "firefox-urlbar-coverage-subscribe", "urlbarCoverage.subscribe");
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
			t(da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", n));
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
			if (c = null, u.clear(), i = null, t !== void 0) throw da(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", t);
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
var ya = Object.freeze([
	"close",
	"minimize",
	"toggle-maximize"
]), ba = new Set(ya);
function xa(e) {
	return typeof e == "string" && ba.has(e);
}
//#endregion
//#region src/firefox/window-controls.ts
var Sa = (e) => typeof e == "object" && !!e, Ca = (e) => typeof e == "function", wa = (e, t) => {
	let n = e.document;
	if (!(!Sa(n) || !Ca(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Ta = (e) => Object.freeze(e), Ea = Object.freeze([
	Ta({
		isAvailable: Ca,
		name: "window-controls.minimize",
		read: (e) => e.minimize,
		symbol: "window.minimize"
	}),
	Ta({
		isAvailable: Ca,
		name: "window-controls.maximize",
		read: (e) => e.maximize,
		symbol: "window.maximize"
	}),
	Ta({
		isAvailable: Ca,
		name: "window-controls.restore",
		read: (e) => e.restore,
		symbol: "window.restore"
	}),
	Ta({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.window-state",
		read: (e) => e.windowState,
		symbol: "window.windowState"
	}),
	Ta({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.state-maximized",
		read: (e) => e.STATE_MAXIMIZED,
		symbol: "window.STATE_MAXIMIZED"
	}),
	Ta({
		isAvailable: Ca,
		name: "window-controls.sizemode-events",
		read: (e) => e.addEventListener,
		symbol: "window.addEventListener"
	}),
	Ta({
		isAvailable: (e) => Sa(e) && Ca(e.doCommand),
		name: "window-controls.close-command",
		read: (e) => wa(e, "cmd_closeWindow"),
		symbol: "document.cmd_closeWindow.doCommand"
	})
]), Da = (e) => Object.freeze(Ea.map((t) => {
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
})), Oa = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, ka = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Oa(e),
	phase: n,
	symbol: r
}), Aa = (e) => {
	let t = e.windowState === e.STATE_MAXIMIZED || typeof e.STATE_FULLSCREEN == "number" && e.windowState === e.STATE_FULLSCREEN;
	return Object.freeze({ maximized: t });
};
function ja({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !Sa(n) || typeof t != "function") throw ka(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_OPTIONS_INVALID", "firefox-window-controls-create", "window");
	let r = n, i = !1, a = new Set(), o, s = () => {
		if (i || !r) throw ka(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_DISPOSED", "firefox-window-controls-access", "window");
		return r;
	}, c = () => {
		let t = Da(s()), n = t.find((e) => !e.snapshot.available);
		if (n) throw ka(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, l = () => {
		let n;
		try {
			n = Aa(s());
		} catch (e) {
			t(e);
			return;
		}
		for (let r of Array.from(a)) try {
			r(n);
		} catch (n) {
			t(ka(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBER_FAILED", "firefox-window-controls-notify", "windowControls.subscribe", n));
		}
	}, u = (t) => {
		if (!xa(t)) throw ka(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_INVALID", "firefox-window-controls-action", "windowControls.action");
		c();
		let n = s();
		try {
			if (t === "minimize") return Reflect.apply(n.minimize, n, []), !0;
			if (t === "toggle-maximize") return Aa(n).maximized ? Reflect.apply(n.restore, n, []) : Reflect.apply(n.maximize, n, []), !0;
			let r = wa(n, "cmd_closeWindow");
			if (!Sa(r) || !Ca(r.doCommand)) throw ka(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-action", "document.cmd_closeWindow.doCommand");
			return Reflect.apply(r.doCommand, r, []), !0;
		} catch (n) {
			throw n instanceof g ? n : ka(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_FAILED", "firefox-window-controls-action", t === "close" ? "document.cmd_closeWindow.doCommand" : `window.${t}`, n);
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
		throw ka(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBE_FAILED", "firefox-window-controls-subscribe", "window.addEventListener", t);
	}
	let d = Object.freeze({
		invoke: u,
		snapshot() {
			return Aa(s());
		},
		subscribe(t) {
			if (typeof t != "function") throw ka(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_LISTENER_INVALID", "firefox-window-controls-subscribe", "windowControls.subscribe");
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
export { g as FirefoxBridgeError, At as addCustomizeLayoutEntry, yt as copyCustomizeLayout, _t as copyCustomizeLayoutEntry, xt as createCustomizeLayout, bt as createEmptyCustomizeLayout, re as createFirefoxBookmarksBridge, T as createFirefoxBridgeBoundary, Oe as createFirefoxBrowserToolsBridge, Jt as createFirefoxDownloadsBridge, Cn as createFirefoxLocaleBridge, cr as createFirefoxNavigationBridge, Pr as createFirefoxTabsBridge, Ki as createFirefoxToolbarWidgetsBridge, va as createFirefoxUrlbarCoverageBridge, ja as createFirefoxWindowControlsBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, an as createStaticLocaleBridge, pt as customizeLayoutBounds, It as customizeLayoutContainsWidget, dt as customizeSpecialKinds, Xt as defaultFenneviaLocale, Et as findCustomizeLayoutEntry, Mt as getCustomizeLayoutEntry, Sn as getShellChromeHostLabel, ht as isCustomizeSpecialKind, gt as isCustomizeWidgetId, _ as isFirefoxBridgeError, Nt as moveCustomizeLayoutEntry, St as parseCustomizeLayout, wt as parseCustomizeStyle, jt as removeCustomizeLayoutEntry, Ct as serializeCustomizeLayout, Tt as serializeCustomizeStyle, un as shellChromeHostNames, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic, Pt as withCustomizeAdopted, Ft as withoutCustomizeAdopted };
