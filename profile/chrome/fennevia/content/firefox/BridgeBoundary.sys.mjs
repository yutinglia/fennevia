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
var ee = "resource://gre/modules/PlacesUtils.sys.mjs", E = "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs", te = Object.freeze([
	"bookmark-added",
	"bookmark-removed",
	"bookmark-moved",
	"bookmark-title-changed",
	"bookmark-url-changed"
]), D = /^[A-Za-z0-9_-]{12}$/u, ne = new Set([
	"data:",
	"javascript:",
	"place:",
	"vbscript:"
]), O = (e) => typeof e == "object" && !!e, k = (e) => typeof e == "function", A = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, j = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: A(e),
	phase: n,
	symbol: r
}), M = (e, t, n, r) => {
	if (typeof t != "string" || !D.test(t)) throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_GUID_INVALID", n, r);
	return t;
}, re = (e) => {
	let t = "", n = 0;
	for (let r of e) {
		if (n >= 160) break;
		t += r, n += 1;
	}
	return t;
}, ie = (e, t, n, r, i) => {
	if (!O(t) || typeof t.guid != "string" || typeof t.parentGuid != "string" || typeof t.index != "number" || !Number.isSafeInteger(t.index) || t.index < 0 || typeof t.type != "number" || typeof t.title != "string" || (M(e, t.guid, r, "PlacesUtils.bookmarks.fetch.result.guid"), M(e, t.parentGuid, r, "PlacesUtils.bookmarks.fetch.result.parentGuid"), i !== void 0 && t.guid !== i || ![
		n.TYPE_BOOKMARK,
		n.TYPE_FOLDER,
		n.TYPE_SEPARATOR
	].includes(t.type) || t.type === n.TYPE_FOLDER && (!Number.isSafeInteger(t.childCount) || t.childCount < 0))) throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID", r, "PlacesUtils.bookmarks.fetch.result");
	return t;
}, ae = (e, t, n) => {
	if (t.type === n.TYPE_BOOKMARK) return "bookmark";
	if (t.type === n.TYPE_FOLDER) return "folder";
	if (t.type === n.TYPE_SEPARATOR) return "separator";
	throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_TYPE_INVALID", "firefox-bookmarks-snapshot", "PlacesUtils.bookmarks.TYPE_BOOKMARK");
}, N = (e) => {
	if (!O(e) || typeof e.href != "string") return null;
	if (typeof e.protocol == "string") return e.protocol.toLowerCase();
	let t = e.href.indexOf(":");
	return t > 0 ? `${e.href.slice(0, t).toLowerCase()}:` : null;
};
//#endregion
//#region src/firefox/bookmarks/controller.ts
function P({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !O(r) || typeof t != "function" || typeof n != "function") throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_OPTIONS_INVALID", "firefox-bookmarks-create", "ChromeUtils.importESModule");
	let i, a;
	try {
		i = t(ee), a = t(E);
	} catch (t) {
		throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_MODULE_LOAD_FAILED", "firefox-bookmarks-module-load", "ChromeUtils.importESModule", t);
	}
	let o = O(i) ? i.PlacesUtils : void 0, s = O(a) ? a.PlacesUIUtils : void 0, c = o, l = s, u = Object.freeze([
		Object.freeze({
			isAvailable: O,
			name: "firefox.places-utils",
			read: () => o,
			symbol: "PlacesUtils"
		}),
		Object.freeze({
			isAvailable: O,
			name: "firefox.places-bookmarks",
			read: () => c?.bookmarks,
			symbol: "PlacesUtils.bookmarks"
		}),
		Object.freeze({
			isAvailable: k,
			name: "firefox.places-bookmarks-fetch",
			read: () => c?.bookmarks?.fetch,
			symbol: "PlacesUtils.bookmarks.fetch"
		}),
		Object.freeze({
			isAvailable: (e) => Array.isArray(e) && e.length === 4 && e.every((e) => typeof e == "string" && D.test(e)),
			name: "firefox.places-bookmark-roots",
			read: () => c?.bookmarks?.userContentRoots,
			symbol: "PlacesUtils.bookmarks.userContentRoots"
		}),
		Object.freeze({
			isAvailable: k,
			name: "firefox.places-root-title",
			read: () => c?.bookmarks?.getLocalizedTitle,
			symbol: "PlacesUtils.bookmarks.getLocalizedTitle"
		}),
		Object.freeze({
			isAvailable: O,
			name: "firefox.places-observers",
			read: () => c?.observers,
			symbol: "PlacesUtils.observers"
		}),
		...["addListener", "removeListener"].map((e) => Object.freeze({
			isAvailable: k,
			name: `firefox.places-observers-${e.toLowerCase()}`,
			read: () => c?.observers?.[e],
			symbol: `PlacesUtils.observers.${e}`
		})),
		Object.freeze({
			isAvailable: O,
			name: "firefox.places-ui-utils",
			read: () => s,
			symbol: "PlacesUIUtils"
		}),
		Object.freeze({
			isAvailable: k,
			name: "firefox.places-node-conversion",
			read: () => l?.promiseNodeLikeFromFetchInfo,
			symbol: "PlacesUIUtils.promiseNodeLikeFromFetchInfo"
		}),
		Object.freeze({
			isAvailable: k,
			name: "firefox.places-open-node",
			read: () => l?.openNodeIn,
			symbol: "PlacesUIUtils.openNodeIn"
		}),
		Object.freeze({
			isAvailable: k,
			name: "firefox.places-organizer",
			read: () => O(r.PlacesCommandHook) ? r.PlacesCommandHook.showPlacesOrganizer : void 0,
			symbol: "window.PlacesCommandHook.showPlacesOrganizer"
		})
	]), d = r, f = !1, p = null, m = !1, h = 0, g = new Set(), v = e.createHandleRegistry("bookmark"), y = new Map(), x = new Map(), S = () => {
		if (f || !d) throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSED", "firefox-bookmarks-access", "window");
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
		if (n) throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING", "firefox-bookmarks-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (t) => {
		S();
		let n = M(e, t, "firefox-bookmarks-handle", "PlacesUtils.bookmarks.guid"), r = x.get(n);
		if (r) return r;
		let i = Object.freeze({ guid: n }), a = v.register(i);
		return y.set(n, i), x.set(n, a), a;
	}, A = (e) => {
		if (typeof e != "string" || !D.test(e)) return !1;
		let t = x.get(e);
		if (!t) return !1;
		x.delete(e), y.delete(e);
		try {
			return v.release(t);
		} catch {
			return !1;
		}
	}, P = (e) => (S(), v.resolve(e).guid), oe = (t, n = t.title) => {
		let r = ae(e, t, c.bookmarks);
		return Object.freeze({
			hasChildren: r === "folder" && Number.isSafeInteger(t.childCount) && t.childCount > 0,
			id: T(t.guid),
			kind: r,
			title: re(n)
		});
	}, se = async (t, n) => {
		S();
		let r;
		try {
			r = await Reflect.apply(c.bookmarks.fetch, c.bookmarks, [t]);
		} catch (t) {
			throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_FAILED", n, "PlacesUtils.bookmarks.fetch", t);
		}
		return S(), r === null ? null : ie(e, r, c.bookmarks, n, "guid" in t ? t.guid : void 0);
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
			n(j(e, "FENNEVIA_FIREFOX_BOOKMARKS_SUBSCRIBER_FAILED", "firefox-bookmarks-notify", "bookmarks.subscribe", t));
		}
	}, le = (t) => {
		p = _(t) ? t : j(e, "FENNEVIA_FIREFOX_BOOKMARKS_OBSERVER_FAILED", "firefox-bookmarks-observer", "PlacesUtils.observers.addListener", t), n(p);
	}, ue = (t) => {
		if (!(f || p)) try {
			if (!Array.isArray(t)) throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEventCallback.events");
			if (t.length > 128) {
				ce(Object.freeze([]), "all");
				return;
			}
			let n = new Set(), r = [];
			for (let i of t) {
				if (!O(i) || typeof i.type != "string" || !te.includes(i.type) || typeof i.parentGuid != "string" || typeof i.isTagging != "boolean") throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEvent");
				if (i.isTagging) continue;
				M(e, i.parentGuid, "firefox-bookmarks-observer", "PlacesEvent.parentGuid");
				let t = x.get(i.parentGuid);
				if (t && n.add(t), i.type === "bookmark-moved") {
					let t = M(e, i.oldParentGuid, "firefox-bookmarks-observer", "PlacesBookmarkMoved.oldParentGuid"), r = x.get(t);
					r && n.add(r);
				}
				i.type === "bookmark-removed" && r.push(M(e, i.guid, "firefox-bookmarks-observer", "PlacesBookmarkRemoved.guid"));
			}
			let i = Array.from(n);
			i.length > 16 ? ce(Object.freeze([]), "all") : i.length > 0 && ce(Object.freeze(i), "parents");
			for (let e of r) A(e);
		} catch (e) {
			le(e);
		}
	}, de = b(() => {
		m && (m = !1, Reflect.apply(c.observers.removeListener, c.observers, [te, ue]));
	}), fe = Object.freeze({
		async children(t, n = {}) {
			let r;
			try {
				r = P(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					parentId: t,
					status: "stale"
				});
				throw e;
			}
			if (!O(n) || Object.keys(n).some((e) => e !== "limit" && e !== "offset")) throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let i = n.limit ?? 32, a = n.offset ?? 0;
			if (!Number.isSafeInteger(i) || i < 1 || i > 32 || !Number.isSafeInteger(a) || a < 0 || a > 1e6) throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let o = await se({ guid: r }, "firefox-bookmarks-query-parent");
			if (!o) return A(r), Object.freeze({
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
		manage() {
			let t = S().PlacesCommandHook, n = O(t) ? t.showPlacesOrganizer : void 0;
			if (!k(n)) throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING", "firefox-bookmarks-manage", "window.PlacesCommandHook.showPlacesOrganizer");
			try {
				Reflect.apply(n, t, ["UnfiledBookmarks"]);
			} catch (t) {
				throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_MANAGE_FAILED", "firefox-bookmarks-manage", "window.PlacesCommandHook.showPlacesOrganizer", t);
			}
			return !0;
		},
		async open(t, n = "current") {
			if (n !== "current" && n !== "new-tab") throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_DISPOSITION_INVALID", "firefox-bookmarks-open", "bookmarks.open.disposition");
			let r;
			try {
				r = P(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					reason: "stale",
					status: "rejected"
				});
				throw e;
			}
			let i = await se({ guid: r }, "firefox-bookmarks-open-fetch");
			if (!i) return A(r), Object.freeze({
				reason: "stale",
				status: "rejected"
			});
			if (i.type !== c.bookmarks.TYPE_BOOKMARK) return Object.freeze({
				reason: "not-bookmark",
				status: "rejected"
			});
			let a = N(i.url);
			if (!a || ne.has(a)) return Object.freeze({
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
				throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_OPEN_FAILED", "firefox-bookmarks-open", "PlacesUIUtils.openNodeIn", t);
			}
			return Object.freeze({ status: "opened" });
		},
		async roots() {
			S();
			let t = c.bookmarks.userContentRoots, n = [];
			for (let r of t) {
				let t = await se({ guid: r }, "firefox-bookmarks-query-roots");
				if (!t || t.type !== c.bookmarks.TYPE_FOLDER) throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.userContentRoots");
				let i;
				try {
					i = Reflect.apply(c.bookmarks.getLocalizedTitle, c.bookmarks, [t]);
				} catch (t) {
					throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_FAILED", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle", t);
				}
				if (typeof i != "string") throw j(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle");
				n.push(oe(t, i));
			}
			return Object.freeze(n);
		},
		subscribe(t) {
			if (S(), typeof t != "function") throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_LISTENER_INVALID", "firefox-bookmarks-subscribe", "bookmarks.subscribe");
			return g.add(t), b(() => {
				g.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), Reflect.apply(c.observers.addListener, c.observers, [te, ue]), m = !0;
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
		throw r !== void 0 && n(j(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", r)), t;
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
			if (t !== void 0) throw j(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", t);
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
	"translate",
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
	"translate",
	"application-menu"
]), ce = new Set(oe), le = new Set(se);
function ue(e) {
	return typeof e == "string" && ce.has(e);
}
function de(e) {
	return typeof e == "string" && le.has(e);
}
//#endregion
//#region src/firefox/browser-tools/support.ts
var fe = Object.freeze({ capture: !0 }), pe = Object.freeze([
	"appMenu-popup",
	"downloadsPanel",
	"identity-popup",
	"permission-popup",
	"protections-popup",
	"trustpanel-popup",
	"unified-extensions-panel",
	"full-page-translations-panel"
]), me = new Set(pe), he = Object.freeze({
	"application-menu": Object.freeze(["appMenu-popup"]),
	downloads: Object.freeze(["downloadsPanel"]),
	extensions: Object.freeze(["unified-extensions-panel"]),
	translate: Object.freeze(["full-page-translations-panel"]),
	protections: Object.freeze(["trustpanel-popup", "protections-popup"]),
	"site-information": Object.freeze(["trustpanel-popup", "identity-popup"]),
	"site-permissions": Object.freeze(["permission-popup"])
}), ge = "bottomcenter topright", _e = Object.freeze({
	"application-menu": ge,
	downloads: "after_start",
	extensions: "after_end",
	translate: "after_end",
	protections: "end_before",
	"site-information": "end_before",
	"site-permissions": "after_end"
}), ve = (e) => e === ge, F = (e) => typeof e == "object" && !!e, I = (e) => typeof e == "function", ye = (e) => {
	let t = e.PanelMultiView;
	if (typeof t == "function") {
		let e = t;
		return I(e.openPopup) ? e : null;
	}
	return F(t) && I(t.openPopup) ? t : null;
}, be = (e) => F(e) && I(e.addEventListener) && I(e.removeEventListener), xe = (e) => F(e) && I(e.click) && I(e.focus), L = (e) => F(e) && I(e.hidePopup) && I(e.moveToAnchor) && I(e.openPopup), R = (e) => typeof e == "number" && Number.isFinite(e) ? e : void 0, Se = (e) => {
	try {
		let t = Reflect.apply(e.getBoundingClientRect, e, []);
		if (!F(t)) return null;
		let n = R(t.left) ?? R(t.x), r = R(t.top) ?? R(t.y), i = R(t.width), a = R(t.height);
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
	let t = R(e.mozInnerScreenX) ?? 0, n = R(e.mozInnerScreenY) ?? 0;
	return Object.freeze({
		x: Math.round(t),
		y: Math.round(n)
	});
}, z = (e, t) => {
	let n = e.document;
	if (!(!F(n) || !I(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, we = (e) => F(e) ? e.panel : void 0, B = (e) => Object.freeze(e), Te = Object.freeze([
	B({
		isAvailable: (e) => xe(e) && I(e.checkVisibility),
		name: "browser-tools.trust-anchor",
		read: (e) => z(e, "trust-icon-container"),
		symbol: "document.trust-icon-container.click.focus.checkVisibility"
	}),
	B({
		isAvailable: xe,
		name: "browser-tools.identity-anchor",
		read: (e) => z(e, "identity-icon-box"),
		symbol: "document.identity-icon-box.click.focus"
	}),
	B({
		isAvailable: xe,
		name: "browser-tools.protections-anchor",
		read: (e) => z(e, "tracking-protection-icon-container"),
		symbol: "document.tracking-protection-icon-container.click.focus"
	}),
	B({
		isAvailable: xe,
		name: "browser-tools.permissions-anchor",
		read: (e) => z(e, "identity-permission-box"),
		symbol: "document.identity-permission-box.click.focus"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.unified-extensions",
		read: (e) => F(e.gUnifiedExtensions) ? e.gUnifiedExtensions.togglePanel : void 0,
		symbol: "window.gUnifiedExtensions.togglePanel"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.full-page-translations",
		read: (e) => F(e.FullPageTranslationsPanel) ? e.FullPageTranslationsPanel.open : void 0,
		requirement: "optional",
		symbol: "window.FullPageTranslationsPanel.open"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.application-menu",
		read: (e) => F(e.PanelUI) ? e.PanelUI.show : void 0,
		symbol: "window.PanelUI.show"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.application-menu-ready",
		read: (e) => F(e.PanelUI) ? e.PanelUI.ensureReady : void 0,
		symbol: "window.PanelUI.ensureReady"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.settings",
		read: (e) => e.openPreferences,
		symbol: "window.openPreferences"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.customize",
		read: (e) => F(e.gCustomizeMode) ? e.gCustomizeMode.enter : void 0,
		symbol: "window.gCustomizeMode.enter"
	}),
	B({
		isAvailable: (e) => F(e) && I(e.focus),
		name: "browser-tools.native-toolbar-focus",
		read: (e) => z(e, "back-button"),
		symbol: "document.back-button.focus"
	}),
	B({
		isAvailable: xe,
		name: "browser-tools.extensions-anchor",
		read: (e) => z(e, "unified-extensions-button"),
		symbol: "document.unified-extensions-button.click.focus"
	}),
	B({
		isAvailable: xe,
		name: "browser-tools.application-menu-anchor",
		read: (e) => z(e, "PanelUI-menu-button"),
		symbol: "document.PanelUI-menu-button.click.focus"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.trust-panel",
		read: (e) => F(e.gTrustPanelHandler) ? e.gTrustPanelHandler.showPopup : void 0,
		symbol: "window.gTrustPanelHandler.showPopup"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.permission-set-anchor",
		read: (e) => F(e.gPermissionPanel) ? e.gPermissionPanel.setAnchor : void 0,
		symbol: "window.gPermissionPanel.setAnchor"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.permission-open-popup",
		read: (e) => F(e.gPermissionPanel) ? e.gPermissionPanel.openPopup : void 0,
		symbol: "window.gPermissionPanel.openPopup"
	}),
	B({
		isAvailable: I,
		name: "browser-tools.downloads-initialize",
		read: (e) => F(e.DownloadsPanel) ? e.DownloadsPanel.initialize : void 0,
		symbol: "window.DownloadsPanel.initialize"
	}),
	B({
		isAvailable: L,
		name: "browser-tools.downloads-panel",
		read: (e) => {
			let t = z(e, "downloadsPanel");
			return L(t) ? t : we(e.DownloadsPanel);
		},
		symbol: "document.downloadsPanel.openPopup.moveToAnchor.hidePopup"
	}),
	B({
		isAvailable: L,
		name: "browser-tools.application-menu-panel",
		read: (e) => {
			let t = z(e, "appMenu-popup");
			return L(t) ? t : we(e.PanelUI);
		},
		symbol: "document.appMenu-popup.openPopup.moveToAnchor.hidePopup"
	}),
	B({
		isAvailable: L,
		name: "browser-tools.extensions-panel",
		read: (e) => {
			let t = z(e, "unified-extensions-panel");
			return L(t) ? t : we(e.gUnifiedExtensions);
		},
		symbol: "document.unified-extensions-panel.openPopup.moveToAnchor.hidePopup"
	}),
	B({
		isAvailable: be,
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
			requirement: t.requirement ?? "required",
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
}, V = (e, t, n, r, i) => new g({
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
		sitePermissions: t("browser-tools.permission-open-popup"),
		translate: t("browser-tools.full-page-translations")
	});
}, ke = (e) => {
	let t = e.state;
	if (t === "open" || t === "showing") return !0;
	let n = e.getAttribute;
	if (!I(n)) return !1;
	let r = Reflect.apply(n, e, ["state"]);
	return r === "open" || r === "showing";
}, Ae = (e) => F(e) ? F(e.originalTarget) ? e.originalTarget : F(e.target) ? e.target : null : null, je = 1e4;
function Me({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, frame: r, requestNativeUiReveal: i, window: a }) {
	if (t.assertOwnsWindow(a), !F(a) || !F(r) || typeof r.contains != "function" || typeof i != "function" || typeof e != "function" || typeof n != "function") throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID", "firefox-browser-tools-create", "window");
	let o = (e) => Reflect.apply(r.contains, r, [e]) === !0, s = a, c = !1, l = 0, u = null, d = new Set(), f = [], p = new Set(), m = new Set(), h = () => {
		if (c || !s) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED", "firefox-browser-tools-access", "window");
		return s;
	}, g = () => {
		let e = Ee(h()), n = e.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(e.map((e) => e.snapshot));
	}, v = () => {
		let e;
		try {
			e = i() === !0;
		} catch (e) {
			throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_FAILED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar", e);
		}
		if (!e) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar");
	}, y = async (e, n, r, i = []) => {
		let a = e[n];
		if (!I(a)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", r);
		try {
			await Reflect.apply(a, e, i);
		} catch (e) {
			throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", r, e);
		}
	}, b = (e) => {
		let n = h();
		if (!F(e) || !I(e.getBoundingClientRect) || e.ownerDocument !== n.document || o(e) !== !0) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID", "firefox-browser-tools-action", "browser-tools.host");
		return e;
	}, x = (e, t) => {
		if (F(e) && I(e.stopPropagation) && (e.type === "click" || e.type === "keypress")) return e;
		let n = h().MouseEvent;
		if (I(n)) try {
			let e = Reflect.construct(n, ["click", Object.freeze({
				bubbles: !0,
				button: 0
			})]);
			if (F(e) && I(e.stopPropagation)) return e;
		} catch {}
		return Object.freeze({
			button: 0,
			stopPropagation() {},
			target: t,
			type: "click"
		});
	}, S = (e) => {
		let t = h();
		for (let n of e) {
			let e = z(t, n);
			if (L(e) && ke(e)) return e;
		}
		return null;
	}, C = (n) => {
		let r;
		try {
			r = e(n) === !0;
		} catch (e) {
			throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_FAILED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff", e);
		}
		if (!r) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_REJECTED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff");
	}, w = (e) => {
		try {
			n(e);
		} catch {}
	}, T = (e, n) => {
		try {
			Reflect.apply(e.hidePopup, e, []);
		} catch (e) {
			throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", n, e);
		}
	}, ee = (e, n, r, i) => {
		try {
			Reflect.apply(e.openPopup, e, [
				n,
				r,
				0,
				0
			]);
		} catch (e) {
			throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
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
			throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
		}
	}, te = (e, t, n, r) => {
		if (ve(n)) {
			let n = Se(t), r = Ce(h()), i = e.moveTo;
			if (n && I(i)) try {
				let t = r.x + n.x, a = r.y + n.y + n.height, o = e.getOuterScreenRect;
				if (I(o)) {
					let i = Reflect.apply(o, e, []);
					if (F(i)) {
						let e = R(i.width);
						e !== void 0 && (t = r.x + n.x + n.width - Math.round(e));
					}
				}
				Reflect.apply(i, e, [t, a]);
				return;
			} catch {}
		}
		E(e, t, n, r);
	}, D = (e) => {
		let t = h();
		for (let n of pe) {
			if (e.has(n)) continue;
			let r = z(t, n);
			L(r) && ke(r) && T(r, `document.${n}.hidePopup`);
		}
	}, ne = (e, t) => {
		let n = e.closest;
		if (I(n)) try {
			if (Reflect.apply(n, e, ["[data-fennevia-address-popup]"]) != null) return "after_end";
			if (Reflect.apply(n, e, ["[data-fennevia-edge=\"left\"]"]) != null) return "end_before";
		} catch {}
		return _e[t];
	}, O = (e) => {
		let t = h();
		for (let n of he[e]) {
			let e = z(t, n);
			if (L(e)) return e;
		}
		return S(he[e]);
	}, k = (e) => {
		let n = O(e);
		if (!n) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", `document.${he[e][0]}.openPopup.moveToAnchor.hidePopup`);
		return n;
	}, A = async (e, n, r, i) => {
		let a = h(), o = ye(a), s = Se(n), c = Ce(a), l, u = () => ke(e), d = async (e) => {
			try {
				await e();
			} catch (e) {
				return l = e, u();
			}
			return u();
		}, f = () => {
			if (ve(r)) try {
				te(e, n, r, `${i}.moveTo`);
			} catch {}
		}, p = o && I(o.openPopup) ? o.openPopup : void 0, m = async (t, n) => !o || !p ? !1 : d(() => Reflect.apply(p, o, [
			e,
			t,
			n
		])), g = () => m(n, Object.freeze({ position: r })), v = () => m(n, r), y = () => s ? m(null, Object.freeze({
			x: s.x,
			y: s.y + s.height
		})) : Promise.resolve(!1), b = () => d(() => {
			ee(e, n, r, `${i}.openPopup`);
		}), x = () => {
			let t = e.openPopupAtScreenRect;
			return !s || !I(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
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
			return !s || !I(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
				c.x + s.x,
				c.y + s.y + s.height,
				!1
			]));
		}, C = (() => {
			let t = e.querySelector;
			if (!I(t)) return !1;
			try {
				return Reflect.apply(t, e, ["panelmultiview"]) != null;
			} catch {
				return !1;
			}
		})(), w = p && (C || ve(r)) ? ve(r) ? [
			async () => {
				let t = e.openPopupAtScreenRect, i = e.openPopup;
				if (!s || !p || !I(t) || !I(i)) return !1;
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
		] : ve(r) ? [
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
		throw _(l) ? l : V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", `${i}.openPopup`, l);
	}, j = async (e, t, n) => {
		let r = k(e), i = typeof r.id == "string" && r.id ? r.id : he[e][0];
		return ke(r) ? (E(r, t, n, `document.${i}.moveToAnchor`), r) : (await A(r, t, n, `document.${i}`), r);
	}, M = async () => {
		let e = h(), t = e.promiseDocumentFlushed;
		if (I(t)) try {
			await Reflect.apply(t, e, [() => void 0]);
			return;
		} catch {}
		await Promise.resolve();
	}, re = (e, t = 800) => {
		let n = h(), r = z(n, e);
		return L(r) && ke(r) ? Promise.resolve(!0) : new Promise((r) => {
			let i = !1, a = (e) => {
				i || (i = !0, r(e));
			}, o = {
				panelId: e,
				resolve: a,
				timeoutHandle: void 0
			}, s = n.setTimeout;
			I(s) ? o.timeoutHandle = Reflect.apply(s, n, [() => {
				m.delete(o);
				let t = z(n, e);
				a(L(t) && ke(t));
			}, t]) : queueMicrotask(() => {
				m.delete(o);
				let t = z(n, e);
				a(L(t) && ke(t));
			}), m.add(o);
		});
	}, ie = (e, t) => {
		let n = s;
		for (let r of Array.from(m)) if (r.panelId === e) {
			if (m.delete(r), n && I(n.clearTimeout)) try {
				Reflect.apply(n.clearTimeout, n, [r.timeoutHandle]);
			} catch {}
			r.resolve(t);
		}
	}, ae = async (e, t) => {
		let n = b(t), r = he[e][0], i = ne(n, e);
		D(new Set(he[e])), await M();
		for (let t of he[e]) C(t);
		return u = Object.freeze({
			host: n,
			panelId: r,
			position: i
		}), u;
	}, N = () => {
		let e = s;
		if (!e || !F(e.gPermissionPanel)) return;
		let t = e.gPermissionPanel.setAnchor;
		if (I(t)) try {
			Reflect.apply(t, e.gPermissionPanel, [null, "bottomleft topleft"]);
		} catch {}
	}, P = (e) => {
		let t = Object.freeze({
			open: e,
			type: "native-popup"
		});
		for (let e of Array.from(p)) e(t);
	}, oe = (e) => {
		if (c) return;
		let t = Ae(e), n = typeof t?.id == "string" ? t.id : typeof t?.getAttribute == "function" ? t.getAttribute("id") : void 0;
		if (typeof n != "string" || !me.has(n)) return;
		let r = F(e) ? e.type : void 0;
		if (r === "popupshown") {
			ie(n, !0);
			for (let e of pe) e !== n && w(e);
			if (u && L(t)) try {
				te(t, u.host, u.position, `document.${n}.moveToAnchor`);
			} catch {}
			P(!0);
			return;
		}
		if (r === "popuphidden") {
			if (d.has(n)) return;
			u = null, n === "permission-popup" && N(), w(n), P(!1);
		}
	}, se = async (e, n, r) => {
		let i = h(), a = await ae(e, n);
		for (let t of he[e]) d.add(t);
		try {
			switch (e) {
				case "site-information":
				case "protections": {
					if (!F(i.gTrustPanelHandler)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gTrustPanelHandler.showPopup");
					try {
						await y(i.gTrustPanelHandler, "showPopup", "window.gTrustPanelHandler.showPopup");
					} catch {}
					let n = S(he[e]);
					return n ? (E(n, a.host, a.position, `document.${n.id ?? a.panelId}.moveToAnchor`), !0) : (await j(e, a.host, a.position), !0);
				}
				case "site-permissions": {
					if (!F(i.gPermissionPanel)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					let n = i.gPermissionPanel.setAnchor;
					if (!I(n)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					try {
						Reflect.apply(n, i.gPermissionPanel, [a.host, a.position]);
					} catch (e) {
						throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor", e);
					}
					try {
						await y(i.gPermissionPanel, "openPopup", "window.gPermissionPanel.openPopup", [Object.freeze({})]);
					} catch {}
					let r = S(he[e]);
					return r ? (E(r, a.host, a.position, "document.permission-popup.moveToAnchor"), !0) : (await j(e, a.host, a.position), !0);
				}
				case "downloads":
					if (!F(i.DownloadsPanel)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.DownloadsPanel.initialize");
					return await y(i.DownloadsPanel, "initialize", "window.DownloadsPanel.initialize"), await j(e, a.host, a.position), !0;
				case "extensions": {
					let n = k(e);
					if (ke(n)) {
						T(n, "document.unified-extensions-panel.hidePopup"), u = null;
						for (let t of he[e]) w(t);
						return P(!1), !0;
					}
					if (!F(i.gUnifiedExtensions)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gUnifiedExtensions.togglePanel");
					let r = ye(i), o = r && I(r.openPopup) ? r.openPopup : void 0;
					if (r && o) try {
						r.openPopup = (e, ...t) => {
							if (!(F(e) && e.id === "unified-extensions-panel")) return Reflect.apply(o, r, [e, ...t]);
						};
					} catch {}
					try {
						await y(i.gUnifiedExtensions, "togglePanel", "window.gUnifiedExtensions.togglePanel");
					} catch {} finally {
						if (r && o) try {
							r.openPopup = o;
						} catch {}
					}
					return await j(e, a.host, a.position), !0;
				}
				case "translate": {
					let n = i.FullPageTranslationsPanel;
					if (!F(n) || !I(n.open)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.FullPageTranslationsPanel.open");
					let o = ye(i), s = o?.openPopup, c = null;
					if (o && I(s)) {
						c = (e, ...t) => {
							if (F(e) && e.id === "full-page-translations-panel") {
								let n = F(t[1]) ? Object.freeze({
									...t[1],
									position: a.position
								}) : Object.freeze({ position: a.position });
								return Reflect.apply(s, o, [
									e,
									a.host,
									n
								]);
							}
							return Reflect.apply(s, o, [e, ...t]);
						};
						try {
							o.openPopup = c;
						} catch {
							c = null;
						}
					}
					let l = !1;
					try {
						await y(n, "open", "window.FullPageTranslationsPanel.open", [x(r, a.host)]), l = await re(a.panelId, je);
					} finally {
						if (o && s && c && o.openPopup === c) try {
							o.openPopup = s;
						} catch {}
					}
					if (!l) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.full-page-translations-panel.popupshown");
					let u = O(e);
					if (!u || !ke(u)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.full-page-translations-panel.openPopup");
					return u.anchorNode !== a.host && te(u, a.host, a.position, "document.full-page-translations-panel.moveToAnchor"), !0;
				}
				case "application-menu": {
					let n = k(e);
					if (ke(n)) {
						T(n, "document.appMenu-popup.hidePopup"), u = null;
						for (let t of he[e]) w(t);
						return P(!1), !0;
					}
					if (!F(i.PanelUI)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.ensureReady");
					await y(i.PanelUI, "ensureReady", "window.PanelUI.ensureReady");
					let r = i.PanelUI._ensureShortcutsShown;
					if (I(r)) try {
						Reflect.apply(r, i.PanelUI, []);
					} catch {}
					try {
						await j(e, a.host, a.position);
					} catch {}
					let o = O(e);
					if (o && ke(o)) return !0;
					if (C("appMenu-popup"), !I(i.PanelUI.show)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.show");
					let s = re("appMenu-popup");
					try {
						let e = Reflect.apply(i.PanelUI.show, i.PanelUI, []);
						Promise.resolve(e).catch(() => {});
					} catch (e) {
						throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.PanelUI.show", e);
					}
					await s;
					let c = O(e);
					return c && ke(c) ? (te(c, a.host, a.position, "document.appMenu-popup.moveTo"), !0) : (await j(e, a.host, a.position), !0);
				}
			}
			throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
		} finally {
			for (let t of he[e]) d.delete(t);
		}
	}, ce = Object.freeze({
		invoke: async (e, n, r) => {
			if (!ue(e)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			let i = h();
			l += 1;
			try {
				if (de(e)) return await se(e, n, r);
				switch (e) {
					case "settings": return await y(i, "openPreferences", "window.openPreferences"), !0;
					case "customize":
						if (!F(i.gCustomizeMode)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gCustomizeMode.enter");
						return await y(i.gCustomizeMode, "enter", "window.gCustomizeMode.enter"), !0;
					case "native-toolbar": {
						v();
						let e = z(i, "back-button");
						if (!F(e) || !I(e.focus)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "document.back-button.focus");
						try {
							Reflect.apply(e.focus, e, [Object.freeze({ preventScroll: !0 })]);
						} catch (e) {
							throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.back-button.focus", e);
						}
						return !0;
					}
				}
				throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			} finally {
				--l;
			}
		},
		snapshot() {
			return Oe(Ee(h()));
		},
		subscribe(e) {
			if (h(), typeof e != "function") throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_LISTENER_INVALID", "firefox-browser-tools-subscribe", "browser-tools.subscribe");
			p.add(e);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, p.delete(e), !0) : !1);
		}
	});
	try {
		t.assertRequiredCapabilities(), g();
		let e = h().document;
		if (!be(e)) throw V(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", "document.addEventListener.removeEventListener");
		f.push(t.subscribe(e, "popupshown", oe, fe), t.subscribe(e, "popuphidden", oe, fe));
	} catch (e) {
		c = !0, s = null;
		for (let e of f.reverse()) try {
			e();
		} catch {}
		throw e;
	}
	return Object.freeze({
		assertRequiredCapabilities: g,
		browserTools: ce,
		dispose() {
			if (c) return !1;
			c = !0;
			let e = s;
			u = null, p.clear();
			for (let e of Array.from(m)) m.delete(e), e.resolve(!1);
			if (e) {
				for (let t of pe) {
					let n = z(e, t);
					if (L(n) && ke(n)) try {
						Reflect.apply(n.hidePopup, n, []);
					} catch {}
					w(t);
				}
				N();
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
var Ne = Object.freeze({
	defaultProgrammaticRevealMs: 1200,
	hideDelayMs: 300,
	maximumProgrammaticRevealMs: 1e4,
	windowLeaveHideDelayMs: 800
}), Pe = Object.freeze({
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
}), Fe = Object.freeze({
	hideDelayMs: Ne.hideDelayMs,
	programmaticRevealMs: Ne.defaultProgrammaticRevealMs,
	triggerThicknessCssPixels: 12,
	windowLeaveHideDelayMs: Ne.windowLeaveHideDelayMs
}), Ie = Object.freeze([
	"built-in",
	"extension-action",
	"fennevia",
	"separator",
	"spacer",
	"spring"
]), Le = Object.freeze([
	"top",
	"left",
	"right",
	"bottom"
]), Re = Object.freeze([
	"show-bookmarks",
	"show-downloads",
	"show-translate"
]), ze = Object.freeze([
	"built-in",
	"extension-action",
	"fennevia",
	"special"
]), Be = Object.freeze([
	"auto",
	"light",
	"dark"
]), Ve = Object.freeze([
	"compact",
	"cozy",
	"comfortable"
]), He = Object.freeze({
	autoHideDelay: Pe.hideDelayMs,
	blur: Object.freeze({
		max: 32,
		min: 0
	}),
	edgeTriggerSize: Pe.triggerThicknessCssPixels,
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
	temporaryRevealDuration: Pe.programmaticRevealMs,
	windowLeaveHideDelay: Pe.windowLeaveHideDelayMs
}), Ue = /^#[0-9A-Fa-f]{6}$/u, We = Object.freeze([
	"accent",
	"border",
	"chromeBackground",
	"surface",
	"text"
]), Ge = /^[a-z][a-z0-9-]{0,63}$/u;
new Set(Ie);
var Ke = new Set(Le), qe = new Set(Re);
new Set(ze);
var Je = new Set(Be), Ye = new Set(Ve), Xe = Object.freeze([
	"separator",
	"spacer",
	"spring"
]);
new Set(Xe);
//#endregion
//#region src/app/toolbar-widgets/errors.ts
var Ze = (e) => {
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
function Qe(e) {
	return typeof e == "string" && Ke.has(e);
}
function $e(e) {
	return typeof e == "string" && qe.has(e);
}
function et(e) {
	return typeof e == "string" && Je.has(e);
}
function tt(e) {
	return typeof e == "string" && Ye.has(e);
}
function nt() {
	return Object.freeze({
		accent: "",
		autoHideDelay: Fe.hideDelayMs,
		blur: 18,
		border: "",
		chromeBackground: "",
		density: "cozy",
		edgeTriggerSize: Fe.triggerThicknessCssPixels,
		fontSize: 12,
		motion: 180,
		radius: 4,
		saturation: 145,
		shadow: 50,
		shortcutHintDuration: 600,
		surface: "",
		surfaceOpacity: 94,
		temporaryRevealDuration: Fe.programmaticRevealMs,
		text: "",
		theme: "auto",
		windowLeaveHideDelay: Fe.windowLeaveHideDelayMs
	});
}
var rt = (e, t) => typeof e == "number" && Number.isSafeInteger(e) && e >= t.min && e <= t.max, it = new Set(We);
function at(e) {
	return typeof e == "string" && it.has(e);
}
function ot(e) {
	return typeof e == "string" ? e === "" ? "" : Ue.test(e) ? e.toLowerCase() : null : null;
}
var st = (e) => ot(e);
function ct(e) {
	if (!e || typeof e != "object") throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = st(e.accent), n = st(e.border), r = st(e.chromeBackground), i = st(e.surface), a = st(e.text);
	if (t === null || n === null || r === null || i === null || a === null || !rt(e.autoHideDelay, He.autoHideDelay) || !rt(e.blur, He.blur) || !tt(e.density) || !rt(e.edgeTriggerSize, He.edgeTriggerSize) || !rt(e.fontSize, He.fontSize) || !rt(e.motion, He.motion) || !rt(e.radius, He.radius) || !rt(e.saturation, He.saturation) || !rt(e.shadow, He.shadow) || !rt(e.shortcutHintDuration, He.shortcutHintDuration) || !rt(e.surfaceOpacity, He.surfaceOpacity) || !rt(e.temporaryRevealDuration, He.temporaryRevealDuration) || !et(e.theme) || !rt(e.windowLeaveHideDelay, He.windowLeaveHideDelay)) throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
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
function lt(e) {
	if (!e || typeof e != "object") throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = Object.keys(e), n = {};
	for (let r of t) {
		if (at(r)) {
			let t = st(e[r]);
			if (t === null) throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
			Object.assign(n, { [r]: t });
			continue;
		}
		Object.assign(n, { [r]: e[r] });
	}
	let r = ct({
		...nt(),
		...n
	});
	if (t.length === 0 || t.some((e) => !(e in r)) || t.some((e) => n[e] !== r[e])) throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let i = {};
	for (let e of t) {
		let t = e;
		Object.assign(i, { [t]: r[t] });
	}
	return Object.freeze(i);
}
function ut() {
	return Object.freeze({
		bottom: Object.freeze([]),
		left: Object.freeze([]),
		right: Object.freeze([]),
		top: Object.freeze([])
	});
}
function dt() {
	return Object.freeze({
		available: !1,
		canEdit: !1,
		layoutCustomized: !1,
		palette: Object.freeze([]),
		style: nt(),
		zones: ut()
	});
}
var ft = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0 && e <= 48, pt = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
function mt(e) {
	if (!e || typeof e != "object") throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	switch (e.type) {
		case "add":
			if (typeof e.token != "string" || !Ge.test(e.token) || !Qe(e.zone) || !ft(e.index) || !pt(e.revision)) throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				token: e.token,
				type: "add",
				zone: e.zone
			});
		case "move":
			if (!Qe(e.fromZone) || !Qe(e.toZone) || !ft(e.fromIndex) || !ft(e.toIndex) || !pt(e.revision)) throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				fromIndex: e.fromIndex,
				fromZone: e.fromZone,
				revision: e.revision,
				toIndex: e.toIndex,
				toZone: e.toZone,
				type: "move"
			});
		case "remove":
			if (!Qe(e.zone) || !ft(e.index) || !pt(e.revision)) throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				type: "remove",
				zone: e.zone
			});
		case "reset-layout":
			if (!pt(e.revision)) throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				revision: e.revision,
				type: "reset-layout"
			});
		case "set-style": return Object.freeze({
			style: lt(e.style),
			type: "set-style"
		});
		case "reset-style": return Object.freeze({ type: "reset-style" });
		default: throw Ze("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	}
}
//#endregion
//#region src/firefox/customize-model.ts
var ht = Object.freeze([
	"separator",
	"spacer",
	"spring"
]), gt = new Set(ht), _t = Object.freeze({
	adoptedMaxEntries: 64,
	serializedMaxLength: 16384,
	widgetIdMaxLength: 128,
	zoneMaxEntries: 48
}), vt = /^[A-Za-z0-9_.-]{1,128}$/u;
function H(e) {
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
function yt(e) {
	return typeof e == "string" && gt.has(e);
}
function bt(e) {
	return typeof e == "string" && vt.test(e);
}
function xt(e) {
	if (!e || typeof e != "object") throw H("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	let t = e;
	if (t.type === "widget" && bt(t.id)) return Object.freeze({
		id: t.id,
		type: "widget"
	});
	if (t.type === "special" && yt(t.kind)) return Object.freeze({
		kind: t.kind,
		type: "special"
	});
	if (t.type === "fennevia" && $e(t.id)) return Object.freeze({
		id: t.id,
		type: "fennevia"
	});
	throw H("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
}
function St(e) {
	if (!e || typeof e != "object") throw H("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e, n = [];
	for (let e of Le) {
		let r = t[e];
		if (!Array.isArray(r) || r.length > _t.zoneMaxEntries) throw H("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
		n.push([e, Object.freeze(r.map(xt))]);
	}
	return Object.freeze(Object.fromEntries(n));
}
function Ct(e) {
	if (!e || typeof e != "object") throw H("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e;
	if (t.version !== 1 || !Array.isArray(t.adopted) || t.adopted.length > _t.adoptedMaxEntries || t.adopted.some((e) => !bt(e))) throw H("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	return Object.freeze({
		adopted: Object.freeze([...t.adopted]),
		version: 1,
		zones: St(t.zones)
	});
}
function wt() {
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
function Tt(e, t = []) {
	return Ct({
		adopted: t,
		version: 1,
		zones: {
			...wt().zones,
			...e
		}
	});
}
function Et(e) {
	if (typeof e != "string" || e === "" || e.length > _t.serializedMaxLength) return null;
	try {
		return Ct(JSON.parse(e));
	} catch {
		return null;
	}
}
function Dt(e) {
	let t = JSON.stringify(Ct(e));
	if (t.length > _t.serializedMaxLength) throw H("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return t;
}
function Ot(e) {
	if (typeof e != "string" || e === "" || e.length > _t.serializedMaxLength) return null;
	try {
		let t = JSON.parse(e);
		return !t || typeof t != "object" || t.version !== 1 ? null : ct({
			...nt(),
			...t,
			version: void 0
		});
	} catch {
		return null;
	}
}
function kt(e) {
	return JSON.stringify({
		...ct(e),
		version: 1
	});
}
function At(e, t) {
	if (t.type === "special") return null;
	for (let n of Le) {
		let r = e.zones[n];
		for (let [e, i] of r.entries()) if (i.type === t.type && i.id === t.id) return Object.freeze({
			index: e,
			zone: n
		});
	}
	return null;
}
var jt = (e) => {
	if (!Qe(e)) throw H("FENNEVIA_CUSTOMIZE_MODEL_ZONE_INVALID");
	return e;
}, Mt = (e, t) => {
	if (!Number.isSafeInteger(e) || e < 0) throw H("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return Math.min(e, t);
}, Nt = (e, t, n) => Object.freeze({
	adopted: e.adopted,
	version: 1,
	zones: Object.freeze({
		...e.zones,
		[t]: Object.freeze([...n])
	})
});
function Pt(e, t, n, r) {
	let i = xt(t), a = jt(n), o = At(e, i), s = e;
	o && (s = Ft(e, o.zone, o.index));
	let c = [...s.zones[a]];
	if (c.length >= _t.zoneMaxEntries) throw H("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return c.splice(Mt(r, c.length), 0, i), Nt(s, a, c);
}
function Ft(e, t, n) {
	let r = jt(t), i = [...e.zones[r]];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw H("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i.splice(n, 1), Nt(e, r, i);
}
function It(e, t, n) {
	let r = jt(t), i = e.zones[r];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw H("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i[n];
}
function Lt(e, t, n, r, i) {
	let a = It(e, t, n), o = Ft(e, t, n), s = [...o.zones[jt(r)]];
	if (s.length >= _t.zoneMaxEntries) throw H("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return s.splice(Mt(i, s.length), 0, a), Nt(o, r, s);
}
function Rt(e, t) {
	if (!bt(t)) throw H("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	if (e.adopted.includes(t)) return e;
	if (e.adopted.length >= _t.adoptedMaxEntries) throw H("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return Object.freeze({
		adopted: Object.freeze([...e.adopted, t]),
		version: 1,
		zones: e.zones
	});
}
function zt(e, t) {
	return e.adopted.includes(t) ? Object.freeze({
		adopted: Object.freeze(e.adopted.filter((e) => e !== t)),
		version: 1,
		zones: e.zones
	}) : e;
}
function Bt(e, t) {
	return At(e, {
		id: t,
		type: "widget"
	}) !== null;
}
//#endregion
//#region src/firefox/downloads/support.ts
var Vt = "resource://gre/modules/Downloads.sys.mjs", Ht = (e) => typeof e == "object" && !!e, Ut = (e) => typeof e == "function", Wt = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Gt = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Wt(e),
	phase: n,
	symbol: r
}), Kt = (e) => typeof e == "number" && Number.isFinite(e) && Number.isSafeInteger(e) && e >= 0, qt = (e, t) => {
	if (!Ht(t) || typeof t.stopped != "boolean" || typeof t.succeeded != "boolean" || typeof t.canceled != "boolean" || typeof t.hasPartialData != "boolean" || typeof t.hasProgress != "boolean" || !Number.isInteger(t.progress) || t.progress < 0 || t.progress > 100 || !Kt(t.currentBytes) || !Kt(t.totalBytes)) throw Gt(e, "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID", "firefox-downloads-event", "Download");
	return t;
}, Jt = (e) => e.stopped ? e.succeeded ? "succeeded" : e.error ? "failed" : e.canceled ? e.hasPartialData ? "paused" : "canceled" : "queued" : "active", Yt = (e) => e === "succeeded" || e === "failed" || e === "canceled", Xt = (e) => Math.min(e, 999), Zt = () => Object.freeze({
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
function Qt({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !Ht(r) || typeof t != "function" || typeof n != "function") throw Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_OPTIONS_INVALID", "firefox-downloads-create", "ChromeUtils.importESModule");
	let i;
	try {
		i = t(Vt);
	} catch (t) {
		throw Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_MODULE_LOAD_FAILED", "firefox-downloads-module-load", "ChromeUtils.importESModule", t);
	}
	let a = Ht(i) ? i.Downloads : void 0, o = a, s = e.snapshot().windowKind === "private" ? "private" : "public", c = s === "private" ? o?.PRIVATE : o?.PUBLIC, l = Object.freeze([
		Object.freeze({
			isAvailable: Ht,
			name: "firefox.downloads",
			read: () => a,
			symbol: "Downloads"
		}),
		Object.freeze({
			isAvailable: Ut,
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
	]), u = r, d = null, f = !1, p = null, m = !0, h = 0, g = !1, v = !1, y = 0, x = 0, S = !1, C = Zt(), w = "", T = new Set(), ee = e.createHandleRegistry("download"), E = new Map(), te = new WeakSet(), D = [], ne = () => {
		if (f || !u) throw Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSED", "firefox-downloads-access", "window");
		if (p) throw p;
		return e.assertOwnsWindow(u), u;
	}, O = () => {
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
			available: Ut(d.addView),
			name: "firefox.downloads-list-add-view",
			requirement: "required",
			symbol: "DownloadList.addView"
		}) }), Object.freeze({ snapshot: Object.freeze({
			available: Ut(d.removeView),
			name: "firefox.downloads-list-remove-view",
			requirement: "required",
			symbol: "DownloadList.removeView"
		}) })), Object.freeze(e);
	}, k = () => {
		ne();
		let t = O(), n = t.find((e) => !e.snapshot.available);
		if (n) throw Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, A = (t) => p || (p = _(t) ? t : Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_EVENT_FAILED", "firefox-downloads-event", "DownloadList.view", t), n(p), p), j = (e) => {
		let t = E.get(e);
		if (!t) return !1;
		E.delete(e);
		let n = D.indexOf(e);
		return n !== -1 && D.splice(n, 1), ee.release(t.id), !0;
	}, M = (e) => {
		let t = D.indexOf(e);
		for (t !== -1 && D.splice(t, 1), D.unshift(e); D.length > 3;) {
			let e = D.pop();
			e && j(e);
		}
	}, re = (t) => {
		let n = qt(e, t), r = Jt(n);
		if (m && (te.add(n), Yt(r))) return;
		let i = E.get(n);
		if (!(!i && Yt(r) && te.has(n))) {
			if (i || (i = {
				currentBytes: 0,
				download: n,
				hasProgress: !1,
				id: ee.register(n),
				order: ++x,
				progressPercent: null,
				state: r,
				totalBytes: 0
			}, E.set(n, i)), i.currentBytes = n.currentBytes, i.hasProgress = n.hasProgress, i.progressPercent = r === "succeeded" ? 100 : n.hasProgress ? n.progress : null, i.state = r, i.totalBytes = n.totalBytes, Yt(r)) M(n);
			else {
				let e = D.indexOf(n);
				e !== -1 && D.splice(e, 1);
			}
		}
	}, ie = (e) => {
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
	}, ae = () => {
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
		})), i = ie(e.active), a = Object.freeze({
			active: e.active.length,
			canceled: e.canceled.length,
			failed: e.failed.length,
			paused: e.paused.length,
			queued: e.queued.length,
			succeeded: e.succeeded.length
		}), o = Object.values(a).some((e) => e > 999);
		return Object.freeze({
			activeCount: Xt(a.active),
			aggregatePercent: i.percent,
			canceledCount: Xt(a.canceled),
			countOverflow: o,
			failedCount: Xt(a.failed),
			items: Object.freeze(r),
			pausedCount: Xt(a.paused),
			phase: v ? "ready" : "loading",
			progressMode: i.mode,
			queuedCount: Xt(a.queued),
			revision: y + 1,
			succeededCount: Xt(a.succeeded),
			truncated: n.length > 6 || o
		});
	}, N = () => {
		if (f || p || m || h > 0) {
			g = !0;
			return;
		}
		g = !1;
		let t = ae(), n = JSON.stringify({
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
				A(Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_SUBSCRIBER_FAILED", "firefox-downloads-notify", "downloads.subscribe", t));
				return;
			}
		}
	}, P = Object.freeze({
		onDownloadAdded(e) {
			if (!(f || p)) try {
				re(e), N();
			} catch (e) {
				A(e);
			}
		},
		onDownloadBatchEnded() {
			f || p || (h > 0 && --h, h === 0 && g && N());
		},
		onDownloadBatchStarting() {
			!f && !p && (h += 1);
		},
		onDownloadChanged(e) {
			if (!(f || p)) try {
				re(e), N();
			} catch (e) {
				A(e);
			}
		},
		onDownloadRemoved(t) {
			if (!(f || p)) try {
				let n = qt(e, t);
				j(n), N();
			} catch (e) {
				A(e);
			}
		}
	}), oe = b(() => {
		!S || !d || (S = !1, Reflect.apply(d.removeView, d, [P]));
	});
	e.assertRequiredCapabilities(), k();
	let se = (async () => {
		try {
			let t = await Reflect.apply(o.getList, o, [c]);
			if (f) return !0;
			if (!Ht(t) || !Ut(t.addView) || !Ut(t.removeView)) throw Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", !Ht(t) || !Ut(t.addView) ? "DownloadList.addView" : "DownloadList.removeView");
			if (d = t, S = !0, Reflect.apply(d.addView, d, [P]), f) return oe(), !0;
			if (m = !1, h = 0, p) throw p;
			return v = !0, N(), !0;
		} catch (t) {
			if (f) return !0;
			throw p ?? A(_(t) ? t : Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_INITIALIZATION_FAILED", "firefox-downloads-initialize", "Downloads.getList", t));
		}
	})();
	se.catch(() => void 0);
	let ce = Object.freeze({
		ready() {
			return ne(), se;
		},
		snapshot() {
			return ne(), C;
		},
		subscribe(t) {
			if (ne(), typeof t != "function") throw Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_LISTENER_INVALID", "firefox-downloads-subscribe", "downloads.subscribe");
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
				oe();
			} catch (e) {
				t = e;
			}
			T.clear(), E.clear(), D.length = 0;
			try {
				ee.dispose();
			} catch (e) {
				t ??= e;
			}
			if (d = null, t !== void 0) throw Gt(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSE_FAILED", "firefox-downloads-dispose", "DownloadList.removeView", t);
			return !0;
		},
		downloads: ce,
		ready() {
			return ne(), se;
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
//#region src/app/locale-state.ts
var $t = Object.freeze(["en", "zh-Hant"]), en = "en", tn = new Set($t), nn = (e) => {
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
}, rn = (e) => e.trim().replaceAll("_", "-").toLowerCase(), an = (e, t) => e === t || e.startsWith(`${t}-`);
function on(e) {
	return typeof e == "string" && tn.has(e);
}
function sn(e) {
	return typeof e != "string" || e.trim().length === 0 ? "en" : an(rn(e), "zh") ? "zh-Hant" : "en";
}
function cn(e) {
	if (!e || typeof e != "object" || !on(e.id)) throw nn("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
	return Object.freeze({ id: e.id });
}
function ln(e = "en") {
	if (!on(e)) throw nn("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
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
var un = Object.freeze({
	en: {
		"address.close": "Close",
		"address.closeAria": "Close address and search",
		"address.empty": "Enter an address or search.",
		"address.enterHint": "Enter to open · Escape to cancel",
		"address.fieldLabel": "Enter an address or search",
		"address.firefoxControls": "Firefox controls",
		"address.loading": "The current page is loading.",
		"address.nativeAccess": "Open Firefox address bar",
		"address.nativeAccessDescription": "Use Firefox for extension actions and complete address-bar controls.",
		"address.openSitePermissions": "Open Firefox site permissions. {label}",
		"address.openTrust": "Open Firefox site trust. Connection: {connection}. Protection: {protection}",
		"address.placeholder": "Search or enter address",
		"address.privateBrowsing": "Private browsing",
		"address.productName": "Fennevia",
		"address.statusSitePermissions": "Site permissions",
		"address.statusTrust": "Site trust",
		"address.submitting": "Opening with Firefox…",
		"address.submissionFailed": "Firefox could not open this entry. Native controls remain available.",
		"address.title": "Address and search",
		"address.tooLong": "Keep the address or search under {max} characters.",
		"address.unsafeScheme": "Executable address schemes are not opened here.",
		"address.urlbarItemsAria": "Applicable Firefox address-bar items",
		"suggestions.count": "{count} Firefox suggestions available.",
		"suggestions.empty": "Firefox found no suggestions.",
		"suggestions.failed": "Firefox suggestions are unavailable. Enter still opens the typed value.",
		"suggestions.heuristicBadge": "Best match",
		"suggestions.listAria": "Firefox address-bar suggestions",
		"suggestions.loading": "Getting suggestions from Firefox…",
		"suggestions.nativeBadge": "Open in Firefox",
		"suggestions.nativeResult": "Continue in the full Firefox address bar",
		"suggestions.source.actions": "Firefox action",
		"suggestions.source.addon": "Extension",
		"suggestions.source.bookmarks": "Bookmark",
		"suggestions.source.history": "History",
		"suggestions.source.other-local": "Firefox",
		"suggestions.source.other-network": "Firefox service",
		"suggestions.source.search": "Search",
		"suggestions.source.tabs": "Open tab",
		"suggestions.source.unknown": "Firefox result",
		"bookmarks.collapseLimit": "Collapse a folder before opening another deep branch.",
		"bookmarks.collapseFolder": "Collapse folder",
		"bookmarks.contextMenuAria": "Bookmark actions",
		"bookmarks.emptyFolder": "No bookmarks here.",
		"bookmarks.error": "Bookmarks are unavailable. Native Firefox tools remain usable.",
		"bookmarks.folderChanged": "This folder changed or was removed.",
		"bookmarks.folderLoadError": "Couldn't load this folder.",
		"bookmarks.folderPages": "Folder pages",
		"bookmarks.expandFolder": "Expand folder",
		"bookmarks.hint": "Ctrl or Command + Enter opens a bookmark in a new tab.",
		"bookmarks.listAria": "Bookmarks in selected location",
		"bookmarks.loading": "Loading bookmark locations…",
		"bookmarks.loadingShort": "Loading…",
		"bookmarks.location": "Location",
		"bookmarks.locationTitle": "Bookmark location",
		"bookmarks.manage": "Manage bookmarks",
		"bookmarks.next": "Next",
		"bookmarks.openFailed": "Firefox could not open that bookmark.",
		"bookmarks.openCurrent": "Open",
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
		"nav.openTrust": "Open Firefox site trust. Connection: {connection}. Protection: {protection}",
		"nav.primaryNavigation": "Primary navigation",
		"nav.private": "Private",
		"nav.reload": "Reload",
		"nav.reloadAria": "Reload page",
		"nav.settings": "Settings",
		"nav.settingsAria": "Open Firefox settings",
		"nav.stop": "Stop",
		"nav.stopAria": "Stop loading",
		"panelContext.aria": "{edge} actions",
		"panelContext.customizeFennevia": "Customize Fennevia",
		"panelContext.customizeFirefox": "Customize Firefox toolbar",
		"panelContext.nativeToolbar": "Show original Firefox toolbar",
		"panelContext.newTab": "New tab",
		"panelContext.openDownloads": "Open Firefox Downloads",
		"panelContext.settings": "Firefox settings",
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
		"trust.summary": "{connection} · {protection}",
		"surface.bottom": "Downloads",
		"surface.left": "Tabs and address",
		"surface.right": "Bookmarks",
		"surface.top": "Browser controls",
		"tab.allowMedia": "Allow media for",
		"tab.attention": "Attention",
		"tab.cameraInUse": "Using camera",
		"tab.close": "Close",
		"tab.closeTab": "Close tab",
		"tab.crashed": "Crashed",
		"tab.indexOf": "{index} of {total}",
		"tab.loading": "Loading",
		"tab.mediaBlocked": "Media blocked",
		"tab.microphoneInUse": "Using microphone",
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
		"tab.screenSharing": "Sharing screen",
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
		"widget.showTranslate": "Translate this page",
		"widget.showTranslateTooltip": "Open Firefox built-in translations",
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
		"address.firefoxControls": "Firefox 控制",
		"address.loading": "目前頁面正在載入。",
		"address.nativeAccess": "開啟 Firefox 網址列",
		"address.nativeAccessDescription": "使用 Firefox 可開啟擴充功能動作與完整網址列控制。",
		"address.openSitePermissions": "開啟 Firefox 網站權限。{label}",
		"address.openTrust": "開啟 Firefox 網站信任。連線：{connection}。保護：{protection}",
		"address.placeholder": "搜尋或輸入網址",
		"address.privateBrowsing": "隱私瀏覽",
		"address.productName": "Fennevia",
		"address.statusSitePermissions": "網站權限",
		"address.statusTrust": "網站信任",
		"address.submitting": "正在以 Firefox 開啟…",
		"address.submissionFailed": "Firefox 無法開啟此項目。原生控制項仍可使用。",
		"address.title": "網址與搜尋",
		"address.tooLong": "請將網址或搜尋控制在 {max} 個字元以內。",
		"address.unsafeScheme": "不會在此開啟可執行的網址配置。",
		"address.urlbarItemsAria": "適用的 Firefox 網址列項目",
		"suggestions.count": "有 {count} 個 Firefox 建議可用。",
		"suggestions.empty": "Firefox 找不到建議。",
		"suggestions.failed": "Firefox 建議目前無法使用。按 Enter 仍可開啟輸入內容。",
		"suggestions.heuristicBadge": "最佳結果",
		"suggestions.listAria": "Firefox 網址列建議",
		"suggestions.loading": "正在向 Firefox 取得建議…",
		"suggestions.nativeBadge": "在 Firefox 開啟",
		"suggestions.nativeResult": "在完整 Firefox 網址列中繼續",
		"suggestions.source.actions": "Firefox 動作",
		"suggestions.source.addon": "擴充功能",
		"suggestions.source.bookmarks": "書籤",
		"suggestions.source.history": "瀏覽紀錄",
		"suggestions.source.other-local": "Firefox",
		"suggestions.source.other-network": "Firefox 服務",
		"suggestions.source.search": "搜尋",
		"suggestions.source.tabs": "已開啟分頁",
		"suggestions.source.unknown": "Firefox 結果",
		"bookmarks.collapseLimit": "請先收合一個資料夾，再開啟另一個深層分支。",
		"bookmarks.collapseFolder": "收合資料夾",
		"bookmarks.contextMenuAria": "書籤操作",
		"bookmarks.emptyFolder": "這裡沒有書籤。",
		"bookmarks.error": "書籤無法使用。原生 Firefox 工具仍可使用。",
		"bookmarks.folderChanged": "此資料夾已變更或被移除。",
		"bookmarks.folderLoadError": "無法載入此資料夾。",
		"bookmarks.folderPages": "資料夾分頁",
		"bookmarks.expandFolder": "展開資料夾",
		"bookmarks.hint": "Ctrl 或 Command + Enter 可在新分頁開啟書籤。",
		"bookmarks.listAria": "所選位置中的書籤",
		"bookmarks.loading": "正在載入書籤位置…",
		"bookmarks.loadingShort": "載入中…",
		"bookmarks.location": "位置",
		"bookmarks.locationTitle": "書籤位置",
		"bookmarks.manage": "管理書籤",
		"bookmarks.next": "下一頁",
		"bookmarks.openFailed": "Firefox 無法開啟該書籤。",
		"bookmarks.openCurrent": "開啟",
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
		"nav.openTrust": "開啟 Firefox 網站信任。連線：{connection}。保護：{protection}",
		"nav.primaryNavigation": "主要導覽",
		"nav.private": "隱私",
		"nav.reload": "重新載入",
		"nav.reloadAria": "重新載入頁面",
		"nav.settings": "設定",
		"nav.settingsAria": "開啟 Firefox 設定",
		"nav.stop": "停止",
		"nav.stopAria": "停止載入",
		"panelContext.aria": "{edge}操作",
		"panelContext.customizeFennevia": "自訂 Fennevia",
		"panelContext.customizeFirefox": "自訂 Firefox 工具列",
		"panelContext.nativeToolbar": "顯示原始 Firefox 工具列",
		"panelContext.newTab": "新增分頁",
		"panelContext.openDownloads": "開啟 Firefox 下載面板",
		"panelContext.settings": "Firefox 設定",
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
		"trust.summary": "{connection} · {protection}",
		"surface.bottom": "下載",
		"surface.left": "分頁與網址",
		"surface.right": "書籤",
		"surface.top": "瀏覽器控制項",
		"tab.allowMedia": "允許媒體：",
		"tab.attention": "需要注意",
		"tab.cameraInUse": "正在使用相機",
		"tab.close": "關閉",
		"tab.closeTab": "關閉分頁",
		"tab.crashed": "已崩潰",
		"tab.indexOf": "第 {index} 個，共 {total} 個",
		"tab.loading": "載入中",
		"tab.mediaBlocked": "已封鎖媒體",
		"tab.microphoneInUse": "正在使用麥克風",
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
		"tab.screenSharing": "正在分享螢幕",
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
		"widget.showTranslate": "翻譯此頁面",
		"widget.showTranslateTooltip": "開啟 Firefox 內建翻譯",
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
function dn(e, t) {
	return t ? e.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, (e, n) => {
		let r = t[n];
		return r === void 0 ? e : String(r);
	}) : e;
}
function fn(e, t, n) {
	return dn((un[e] ?? un.en)[t] ?? un.en[t] ?? t, n);
}
//#endregion
//#region src/firefox/locale.ts
var pn = "intl:app-locales-changed", mn = Object.freeze([
	"frame",
	"overlay",
	"top",
	"left",
	"right",
	"bottom"
]), hn = Object.freeze({
	bottom: "chrome.host.bottom",
	frame: "chrome.host.frame",
	left: "chrome.host.left",
	overlay: "chrome.host.overlay",
	right: "chrome.host.right",
	top: "chrome.host.top"
}), gn = (e) => typeof e == "object" && !!e, _n = (e) => typeof e == "function", vn = (e) => {
	let t = e.Services;
	if (!gn(t)) return null;
	let n = t.locale;
	return gn(n) ? n : null;
}, yn = (e) => {
	let t = e.Services;
	if (!gn(t)) return null;
	let n = t.obs;
	return !gn(n) || !_n(n.addObserver) || !_n(n.removeObserver) ? null : n;
}, bn = Object.freeze([Object.freeze({
	isAvailable: (e) => e !== null,
	name: "locale.app-locale",
	read: (e) => vn(e),
	requirement: "optional",
	symbol: "window.Services.locale.appLocaleAsBCP47"
}), Object.freeze({
	isAvailable: (e) => e !== null,
	name: "locale.app-locales-observer",
	read: (e) => yn(e),
	requirement: "optional",
	symbol: "window.Services.obs.addObserver.removeObserver"
})]), xn = (e) => Object.freeze(bn.map((t) => {
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
})), Sn = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Cn = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Sn(e),
	phase: n,
	symbol: r
}), wn = (e) => {
	let t = vn(e);
	if (!t) return "";
	try {
		let e = t.appLocaleAsBCP47;
		return typeof e == "string" ? e : "";
	} catch {
		return "";
	}
}, Tn = (e) => Object.freeze({ id: sn(wn(e)) }), En = (e, t) => fn(e, hn[t]);
function Dn({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !gn(n)) throw Cn(e, "FENNEVIA_FIREFOX_LOCALE_OPTIONS_INVALID", "firefox-locale-create", "window");
	let r = typeof t == "function" ? t : () => {}, i = n, a = !1, o = new Set(), s = !1, c = Object.freeze({ observe() {
		u();
	} }), l = () => {
		if (a || !i) throw Cn(e, "FENNEVIA_FIREFOX_LOCALE_DISPOSED", "firefox-locale-access", "window");
		return i;
	}, u = () => {
		let t;
		try {
			t = Tn(l());
		} catch (e) {
			r(e);
			return;
		}
		for (let n of Array.from(o)) try {
			n(t);
		} catch (t) {
			r(Cn(e, "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBER_FAILED", "firefox-locale-notify", "locale.subscribe", t));
		}
	}, d = () => {
		if (!s || !i) {
			s = !1;
			return;
		}
		let e = yn(i);
		if (e) try {
			Reflect.apply(e.removeObserver, e, [c, pn]);
		} catch {}
		s = !1;
	}, f = yn(n);
	if (f) try {
		Reflect.apply(f.addObserver, f, [c, pn]), s = !0;
	} catch (t) {
		r(Cn(e, "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBE_FAILED", "firefox-locale-subscribe", "window.Services.obs.addObserver", t));
	}
	let p = Object.freeze({
		snapshot() {
			return cn(Tn(l()));
		},
		subscribe(t) {
			if (typeof t != "function") throw Cn(e, "FENNEVIA_FIREFOX_LOCALE_LISTENER_INVALID", "firefox-locale-subscribe", "locale.subscribe");
			return l(), o.add(t), () => o.delete(t);
		}
	});
	return Object.freeze({
		assertRequiredCapabilities() {
			let t = xn(l()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
			if (n) throw Cn(e, "FENNEVIA_FIREFOX_LOCALE_CAPABILITY_MISSING", "firefox-locale-capability", n.snapshot.symbol, n.cause);
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
var On = 2048, kn = 4096, An = (e) => {
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
function jn(e) {
	if (!e || typeof e != "object") throw An("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	let t = e;
	if (typeof t.altKey != "boolean" || typeof t.ctrlKey != "boolean" || typeof t.metaKey != "boolean" || typeof t.shiftKey != "boolean" || !Number.isInteger(t.button) || t.button < 0 || t.button > 2) throw An("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
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
var Mn = Object.freeze({
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
}), Nn = Object.freeze(["TabSelect", "TabAttrModified"]), Pn = new Set([
	"busy",
	"label",
	"selected"
]), Fn = "Browser:OpenLocation", In = Object.freeze({
	selectAll: !0,
	source: "ctrl-l",
	type: "address-popup-open"
}), Ln = Object.freeze({ status: "accepted" }), Rn = Object.freeze({
	reason: "empty",
	status: "rejected"
}), zn = Object.freeze({
	reason: "too-long",
	status: "rejected"
}), Bn = Object.freeze({
	reason: "unsafe-scheme",
	status: "rejected"
}), Vn = /^\s*(?:data|javascript|vbscript)\s*:/iu, Hn = new Set([
	"about:blank",
	"about:home",
	"about:newtab",
	"about:privatebrowsing"
]), Un = Object.freeze({
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
}), Wn = (e) => `document.commands[${e.replaceAll(":", "-")}]`, U = (e) => typeof e == "object" && !!e, W = (e) => typeof e == "function", Gn = (e) => U(e) && W(e.addEventListener) && W(e.removeEventListener), Kn = (e) => e.gBrowser, qn = (e, t) => {
	let n = Kn(e);
	return U(n) ? n[t] : void 0;
}, Jn = (e, t) => {
	let n = qn(e, "selectedBrowser");
	return U(n) ? n[t] : void 0;
}, Yn = (e, t) => {
	let n = e.BrowserCommands;
	return U(n) ? n[t] : void 0;
}, Xn = (e, t) => {
	let n = e.gURLBar;
	return U(n) ? n[t] : void 0;
}, Zn = (e, t) => e[t], Qn = (e) => {
	let t = e.document;
	return U(t) ? t.documentElement : void 0;
}, $n = (e, t) => {
	let n = e.document;
	if (!(!U(n) || !W(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, er = (e) => U(e) && W(e.hasAttribute), tr = (e) => Gn(e) && typeof e.value == "string" && W(e.getAttribute) && W(e.handleCommand), nr = (e) => U(e) && W(e.getConnectionSecurityInformation), rr = (e) => U(e) && W(e.onContentBlockingEvent), ir = (e) => U(e) && W(e.canHandle), ar = (e) => U(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", or = (e) => U(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), sr = Object.freeze([
	Object.freeze({
		isAvailable: ar,
		name: "firefox.navigation-selected-browser",
		read: (e) => qn(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: or,
		name: "firefox.navigation-current-uri",
		read: (e) => Jn(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: W,
		name: "firefox.navigation-selected-browser-focus",
		read: (e) => Jn(e, "focus"),
		symbol: "window.gBrowser.selectedBrowser.focus"
	}),
	Object.freeze({
		isAvailable: (e) => U(e) && W(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => qn(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: Gn,
		name: "firefox.navigation-tab-events",
		read: (e) => qn(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: W,
		name: `firefox.navigation-${e}`,
		read: (e) => qn(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: W,
		name: "firefox.navigation-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: (e) => typeof e == "string",
		name: "firefox.navigation-urlbar-value",
		read: (e) => Xn(e, "value"),
		symbol: "window.gURLBar.value"
	}),
	Object.freeze({
		isAvailable: W,
		name: "firefox.navigation-urlbar-submission",
		read: (e) => Xn(e, "handleCommand"),
		symbol: "window.gURLBar.handleCommand"
	}),
	Object.freeze({
		isAvailable: W,
		name: "firefox.navigation-urlbar-proxy-state",
		read: (e) => Xn(e, "getAttribute"),
		symbol: "window.gURLBar.getAttribute"
	}),
	Object.freeze({
		isAvailable: nr,
		name: "firefox.navigation-connection-security",
		read: (e) => Zn(e, "gIdentityHandler"),
		symbol: "window.gIdentityHandler.getConnectionSecurityInformation"
	}),
	Object.freeze({
		isAvailable: rr,
		name: "firefox.navigation-tracking-protection",
		read: (e) => Zn(e, "gProtectionsHandler"),
		symbol: "window.gProtectionsHandler.onContentBlockingEvent"
	}),
	Object.freeze({
		isAvailable: ir,
		name: "firefox.navigation-tracking-protection-availability",
		read: (e) => Zn(e, "ContentBlockingAllowList"),
		symbol: "window.ContentBlockingAllowList.canHandle"
	}),
	Object.freeze({
		isAvailable: (e) => er(e) && Gn(e),
		name: "firefox.navigation-open-location-command",
		read: (e) => $n(e, Fn),
		symbol: Wn(Fn)
	}),
	Object.freeze({
		isAvailable: (e) => U(e) && W(e.hasAttribute),
		name: "firefox.navigation-shell-health-gate",
		read: Qn,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Object.values(Mn).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: er,
		name: `firefox.navigation-command-${t}`,
		read: (t) => $n(t, e),
		symbol: Wn(e)
	}), Object.freeze({
		isAvailable: W,
		name: `firefox.navigation-action-${t}`,
		read: (e) => Yn(e, t),
		symbol: `window.BrowserCommands.${t}`
	})]),
	Object.freeze({
		isAvailable: W,
		name: "firefox.navigation-action-home",
		read: (e) => Yn(e, "home"),
		symbol: "window.BrowserCommands.home"
	}),
	Object.freeze({
		isAvailable: W,
		name: "firefox.navigation-action-reloadOrDuplicate",
		read: (e) => Yn(e, "reloadOrDuplicate"),
		symbol: "window.BrowserCommands.reloadOrDuplicate"
	})
]), cr = (e) => Object.freeze(sr.map((t) => {
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
})), lr = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, G = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: lr(e),
	phase: n,
	symbol: r
}), ur = (e, t) => e.addressValue === t.addressValue && e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.connectionSecurity === t.connectionSecurity && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title && e.trackingProtection === t.trackingProtection, dr = (e) => {
	if (!U(e) || !U(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Pn.has(e));
};
//#endregion
//#region src/firefox/navigation/controller.ts
function fr({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !U(n) || typeof t != "function") throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID", "firefox-navigation-create", "window");
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
		if (i || !r) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSED", "firefox-navigation-access", "window.gBrowser.selectedBrowser");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, m = () => {
		let t = p().gBrowser;
		if (!U(t)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gBrowser");
		return t;
	}, h = () => {
		let t = m().selectedBrowser;
		if (!ar(t)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, g = () => {
		let t = m().selectedTab;
		if (!U(t) || !W(t.getAttribute)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, v = (t) => {
		let n = $n(p(), t);
		if (!er(n)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", Wn(t));
		return n;
	}, y = () => {
		let t = p().gURLBar;
		if (!tr(t)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gURLBar.handleCommand");
		return t;
	}, x = () => {
		let t = p().gIdentityHandler;
		if (!nr(t)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gIdentityHandler.getConnectionSecurityInformation");
		return t;
	}, S = () => {
		let t = p().gProtectionsHandler;
		if (!rr(t)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gProtectionsHandler.onContentBlockingEvent");
		return t;
	}, C = () => {
		let t = p().ContentBlockingAllowList;
		if (!ir(t)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.ContentBlockingAllowList.canHandle");
		return t;
	}, w = () => {
		let t = cr(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (e) => {
		let t = v(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, ee = (t) => {
		let n = t.currentURI;
		if (!or(n)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, On);
	}, E = (e) => {
		if (Hn.has(e)) return "";
		let t = y();
		return (Reflect.apply(t.getAttribute, t, ["pageproxystate"]) === "valid" ? t.value : e).slice(0, kn);
	}, te = () => {
		let e = x(), t = Reflect.apply(e.getConnectionSecurityInformation, e, []);
		return typeof t == "string" ? Un[t] ?? "unavailable" : "unavailable";
	}, D = (e) => {
		let t = C();
		if (Reflect.apply(t.canHandle, t, [e]) !== !0) return "unavailable";
		let n = S();
		return typeof n.hasException != "boolean" || typeof n.anyBlocking != "boolean" || typeof n.anyDetected != "boolean" ? "unavailable" : n.hasException ? "exception" : n.anyBlocking ? "blocking" : n.anyDetected ? "detected" : "no-trackers-detected";
	}, ne = () => {
		let e = h(), t = g(), n = ee(e);
		return Object.freeze({
			addressValue: E(n),
			canGoBack: T(Mn.back.id),
			canGoForward: T(Mn.forward.id),
			connectionSecurity: te(),
			displayUri: n,
			loading: T(Mn.stop.id),
			title: String(Reflect.apply(t.getAttribute, t, ["label"]) ?? "").slice(0, 256),
			trackingProtection: D(e)
		});
	}, O = () => {
		let n = Object.freeze({
			revision: o,
			snapshot: s,
			type: "snapshot"
		});
		for (let r of Array.from(d)) try {
			r(n);
		} catch (n) {
			t(G(e, "FENNEVIA_FIREFOX_NAVIGATION_SUBSCRIBER_FAILED", "firefox-navigation-notify", "navigation.subscribe", n));
		}
	}, k = (e) => {
		let t = ne();
		return ur(s, t) && o > 0 ? !1 : (s = t, o += 1, e && O(), !0);
	}, A = (n, r) => {
		a = _(n) ? n : G(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, j = (e) => {
		if (!(i || a)) try {
			k(!0);
		} catch (t) {
			A(t, e);
		}
	}, M = (e, t, n) => {
		if (!(i || a)) try {
			e === m().selectedBrowser && U(t) && t.isTopLevel === !0 && k(!0);
		} catch (e) {
			A(e, n);
		}
	}, re = Object.freeze({
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
	}), ie = (e) => ({
		altKey: e.altKey,
		button: e.button,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		preventDefault() {},
		shiftKey: e.shiftKey
	}), ae = (t, n) => {
		let r = p().BrowserCommands, i = U(r) ? r[t] : void 0;
		if (!W(i)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${t}`);
		try {
			return Reflect.apply(i, r, n === void 0 ? [] : [ie(n)]), !0;
		} catch (n) {
			throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${t}`, n);
		}
	}, N = (e, t = !0, n) => {
		let r = Mn[e];
		h();
		let i = v(r.id);
		return t && Reflect.apply(i.hasAttribute, i, ["disabled"]) ? !1 : ae(r.method, n);
	}, P = (t) => {
		if (typeof t != "string") return Rn;
		if (t.length > 4096) return zn;
		if (t.trim().length === 0) return Rn;
		if (Vn.test(t)) return Bn;
		h();
		let n = y();
		try {
			return n.value = t, Reflect.apply(n.handleCommand, n, []), Ln;
		} catch (t) {
			throw G(e, "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED", "firefox-address-submit", "window.gURLBar.handleCommand", t);
		}
	}, oe = () => {
		let e = Qn(p());
		return U(e) && W(e.hasAttribute) && !!Reflect.apply(e.hasAttribute, e, ["data-fennevia-healthy"]);
	}, se = (e) => {
		if (!U(e) || !U(e.sourceEvent)) return !1;
		let t = e.sourceEvent.target;
		return U(t) && t.id === "focusURLBar";
	}, ce = (e) => {
		if (!(i || a)) try {
			if (!oe() || !se(e) || f.size === 0) return;
			k(!0);
			let t = !1;
			for (let e of Array.from(f)) t = e(In) === !0 || t;
			if (!t || !U(e)) return;
			W(e.preventDefault) && Reflect.apply(e.preventDefault, e, []), W(e.stopPropagation) && Reflect.apply(e.stopPropagation, e, []);
		} catch (e) {
			A(e, Wn(Fn));
		}
	}, le = Object.freeze({
		back: (e) => N("back", !0, e === void 0 ? void 0 : jn(e)),
		focusContent() {
			let t = h(), n = t.focus;
			if (!W(n)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus");
			try {
				return Reflect.apply(n, t, []), !0;
			} catch (t) {
				throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus", t);
			}
		},
		forward: (e) => N("forward", !0, e === void 0 ? void 0 : jn(e)),
		home(e) {
			return h(), ae("home", e === void 0 ? void 0 : jn(e));
		},
		newTab: () => N("newTab", !1),
		reload(e) {
			return e === void 0 ? N("reload") : (h(), ae("reloadOrDuplicate", jn(e)));
		},
		reloadOrStop() {
			let e = T(Mn.stop.id) ? "stop" : "reload";
			return N(e), e;
		},
		snapshot() {
			return p(), s;
		},
		stop: () => N("stop"),
		submitAddress: P,
		subscribe(t) {
			if (p(), typeof t != "function") throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_LISTENER_INVALID", "firefox-navigation-subscribe", "navigation.subscribe");
			return d.add(t), b(() => {
				d.delete(t);
			});
		},
		subscribeAddressPopupOpen(t) {
			if (p(), typeof t != "function") throw G(e, "FENNEVIA_FIREFOX_ADDRESS_POPUP_LISTENER_INVALID", "firefox-address-popup-subscribe", "navigation.subscribeAddressPopupOpen");
			return f.add(t), b(() => {
				f.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), k(!1);
		let t = m().tabContainer;
		for (let n of Nn) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (U(e) && e.target !== m().selectedTab || !dr(e))) return;
				k(!0);
			} catch (e) {
				A(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		u.push(e.subscribe(v(Fn), "command", ce));
		let n = m();
		Reflect.apply(n.addTabsProgressListener, n, [re]), l = !0;
		let r = p().MutationObserver;
		c = new r(() => {
			j("document.command.disabled");
		});
		for (let { id: e } of Object.values(Mn)) c.observe(v(e), {
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
			let e = U(r.gBrowser) ? r.gBrowser : null;
			e && W(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [re]);
		} catch (e) {
			a ??= e;
		}
		l = !1;
		for (let e of u.reverse()) try {
			e();
		} catch (e) {
			a ??= e;
		}
		throw r = null, a !== void 0 && t(G(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", a)), n;
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
				let e = U(r.gBrowser) ? r.gBrowser : null;
				if (!e || !W(e.removeTabsProgressListener)) throw TypeError("FENNEVIA_FIREFOX_NAVIGATION_PROGRESS_DISPOSER_INVALID");
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
			if (u.length = 0, d.clear(), f.clear(), r = null, t !== void 0) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", t);
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
var pr = Object.freeze([
	"playing",
	"muted",
	"blocked"
]), mr = Object.freeze([
	"camera",
	"microphone",
	"screen"
]), hr = Object.freeze([
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
new Set(pr);
var gr = new Set(hr), _r = new Set(mr);
function vr(e) {
	return typeof e == "string" && gr.has(e);
}
function yr(e) {
	return typeof e == "string" && _r.has(e);
}
//#endregion
//#region src/firefox/tabs/support.ts
var br = Object.freeze([
	"TabOpen",
	"TabClose",
	"TabSelect",
	"TabMove",
	"TabPinned",
	"TabUnpinned",
	"TabRemotenessChange",
	"TabAttrModified"
]), xr = Object.freeze(["oop-browser-crashed", "oop-browser-buildid-mismatch"]), Sr = new Set([
	"activemedia-blocked",
	"attention",
	"busy",
	"crashed",
	"image",
	"label",
	"muted",
	"pictureinpicture",
	"selected",
	"sharing",
	"soundplaying",
	"usercontextid"
]), Cr = "resource://gre/modules/ContextualIdentityService.sys.mjs", wr = /[\s"'<>\\]/u, Tr = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, Er = Object.freeze({
	toolbar: "gray",
	turquoise: "cyan"
}), Dr = (e) => typeof e == "object" && !!e || typeof e == "function", K = (e) => typeof e == "object" && !!e, Or = (e) => typeof e == "function", kr = (e) => e.gBrowser, Ar = (e, t) => {
	let n = kr(e);
	return K(n) ? n[t] : void 0;
}, jr = (e, t) => {
	let n = e.document;
	if (!(!K(n) || !Or(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Mr = (e) => K(e) && Or(e.openPopup) && Or(e.moveTo) && Or(e.addEventListener) && Or(e.removeEventListener), Nr = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => Ar(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: Dr,
		name: "firefox.selected-tab",
		read: (e) => Ar(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab"
	}),
	Object.freeze({
		isAvailable: (e) => K(e) && Or(e.addEventListener) && Or(e.removeEventListener),
		name: "firefox.tab-crash-events",
		read: kr,
		symbol: "window.gBrowser.addEventListener.removeEventListener"
	}),
	...[
		["add-tab", "addTrustedTab"],
		["remove-tab", "removeTab"],
		["pin-tab", "pinTab"],
		["unpin-tab", "unpinTab"],
		["move-tab", "moveTabTo"],
		["translate-tab-context-menu", "translateTabContextMenu"]
	].map(([e, t]) => Object.freeze({
		isAvailable: Or,
		name: `firefox.${e}`,
		read: (e) => Ar(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: (e) => typeof e == "string" && e.length > 0 && e.length <= 2048,
		name: "firefox.new-tab-url",
		read: (e) => e.BROWSER_NEW_TAB_URL,
		symbol: "window.BROWSER_NEW_TAB_URL"
	}),
	Object.freeze({
		isAvailable: Mr,
		name: "firefox.tab-context-menu",
		read: (e) => jr(e, "tabContextMenu"),
		symbol: "document.tabContextMenu.openPopup.moveTo"
	})
]), Pr = (e) => Object.freeze(Nr.map((t) => {
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
})), Fr = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, q = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Fr(e),
	phase: n,
	symbol: r
}), Ir = (e, t) => {
	if (!K(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw q(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, Lr = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !wr.test(e) || e.length <= 262144 && Tr.test(e))) return e;
}, Rr = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl && e.audio === r.audio && e.attention === r.attention && e.crashed === r.crashed && e.pictureInPicture === r.pictureInPicture && e.sharing === r.sharing && e.container?.color === r.container?.color && e.container?.label === r.container?.label;
}), zr = (e) => {
	if (!K(e) || !K(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Sr.has(e));
}, Br = (e) => {
	if (typeof e != "string" || e.length === 0) return;
	let t = Er[e] ?? e;
	return vr(t) ? t : void 0;
}, Vr = (e) => yr(e) ? e : void 0, Hr = (e, t) => !K(e) || e.target === void 0 || e.target === t || K(e.target) && e.target.id === "tabContextMenu", Ur = "tabContextMenu";
function Wr({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, moduleLoader: r, onError: i, window: a }) {
	if (t.assertOwnsWindow(a), !K(a) || typeof e != "function" || typeof n != "function" || typeof i != "function") throw q(t, "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID", "firefox-tabs-create", "window");
	let o = a, s = !1, c = null, l = 0, u = Object.freeze([]), d = new Set(), f = new Set(), p = [], m = t.createHandleRegistry("tab"), h = null, g = null, v = !1;
	if (typeof r == "function") try {
		let e = r(Cr), t = K(e) ? e.ContextualIdentityService : void 0;
		K(t) && Or(t.getPublicIdentityFromId) && (h = t);
	} catch {
		h = null;
	}
	let y = () => {
		if (s || !o) throw q(t, "FENNEVIA_FIREFOX_TABS_DISPOSED", "firefox-tabs-access", "window.gBrowser.openTabs");
		if (c) throw c;
		return t.assertOwnsWindow(o), o;
	}, x = () => {
		let e = y().gBrowser;
		if (!K(e)) throw q(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "window.gBrowser");
		return e;
	}, S = () => {
		let e = Pr(y()), n = e.find((e) => !e.snapshot.available);
		if (n) throw q(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(e.map((e) => e.snapshot));
	}, C = () => {
		let e = x().openTabs;
		if (!Array.isArray(e)) throw q(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = e.map((e) => Ir(t, e));
		if (new Set(n).size !== n.length) throw q(t, "FENNEVIA_FIREFOX_TAB_ORDER_INVALID", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		return n;
	}, w = (e, t) => Reflect.apply(e.getAttribute, e, [t]), T = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), ee = (e) => {
		if (T(e, "activemedia-blocked")) return "blocked";
		if (T(e, "muted")) return "muted";
		if (T(e, "soundplaying")) return "playing";
	}, E = (e) => {
		if (!h) return;
		let t = Number.parseInt(String(w(e, "usercontextid") ?? ""), 10);
		if (!Number.isSafeInteger(t) || t <= 0) return;
		let n;
		try {
			n = Reflect.apply(h.getPublicIdentityFromId, h, [t]);
		} catch {
			return;
		}
		if (!K(n)) return;
		let r = Br(n.color);
		if (!r) return;
		let i = "";
		if (typeof n.name == "string" && (i = n.name), i.trim().length === 0 && Or(h.getUserContextLabel)) try {
			let e = Reflect.apply(h.getUserContextLabel, h, [t]);
			typeof e == "string" && (i = e);
		} catch {
			i = "";
		}
		let a = i.trim();
		return Object.freeze({
			color: r,
			label: (a.length === 0 ? "Container" : a).slice(0, 80)
		});
	}, te = (e, t) => {
		let n = String(w(e, "label") ?? "").slice(0, 256), r = Lr(w(e, "image")), i = ee(e), a = E(e), o = Vr(w(e, "sharing"));
		return Object.freeze({
			...T(e, "attention") ? { attention: !0 } : {},
			...i === void 0 ? {} : { audio: i },
			...a === void 0 ? {} : { container: a },
			...T(e, "crashed") ? { crashed: !0 } : {},
			...r === void 0 ? {} : { faviconUrl: r },
			...T(e, "pictureinpicture") ? { pictureInPicture: !0 } : {},
			id: m.register(e),
			loading: T(e, "busy"),
			pinned: T(e, "pinned"),
			selected: t === e,
			...o === void 0 ? {} : { sharing: o },
			title: n
		});
	}, D = (e) => {
		for (let n of Array.from(f)) try {
			n(e);
		} catch (e) {
			i(q(t, "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED", "firefox-tabs-notify", "tabs.subscribe", e));
		}
	}, ne = () => {
		D(Object.freeze({
			revision: l,
			tabs: u,
			type: "snapshot"
		}));
	}, O = (e) => {
		let t = x(), n = C().map((e) => te(e, t.selectedTab)), r = new Set(n.map((e) => e.id));
		for (let e of Array.from(d)) r.has(e) || (m.release(e), d.delete(e));
		for (let e of r) d.add(e);
		let i = Object.freeze(n);
		return !Rr(u, i) && (u = i, l += 1, e && ne(), !0);
	}, k = (e, n) => {
		c = _(e) ? e : q(t, "FENNEVIA_FIREFOX_TABS_EVENT_FAILED", "firefox-tabs-event", `window.gBrowser.tabContainer.${n}`, e), i(c);
	}, A = (e) => {
		y();
		let n = m.resolve(e);
		if (!C().includes(n)) throw m.release(e), d.delete(e), q(t, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-action", "tab.opaque-id");
		return n;
	}, j = (e, n) => {
		let r = x(), i = r[e];
		if (typeof i != "function") throw q(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", `window.gBrowser.${e}`);
		return Reflect.apply(i, r, n);
	}, M = (e) => {
		if (e === void 0) return Object.freeze({ selected: !0 });
		if (!K(e) || Object.keys(e).some((e) => e !== "selected") || e.selected !== void 0 && typeof e.selected != "boolean") throw q(t, "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID", "firefox-tabs-action", "tabs.open.options");
		return Object.freeze({ selected: e.selected ?? !0 });
	}, re = (e) => {
		if (!K(e) || Object.keys(e).some((e) => e !== "screenX" && e !== "screenY") || typeof e.screenX != "number" || typeof e.screenY != "number" || !Number.isFinite(e.screenX) || !Number.isFinite(e.screenY) || Math.abs(e.screenX) > 1e5 || Math.abs(e.screenY) > 1e5) throw q(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POINT_INVALID", "firefox-tabs-action", "tabs.openContextMenu.point");
		return Object.freeze({
			screenX: e.screenX,
			screenY: e.screenY
		});
	}, ie = () => {
		if (y(), !g || !Mr(g)) throw q(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
		return g;
	}, ae = () => {
		if (v) return;
		let n;
		try {
			n = e(Ur) === !0;
		} catch (e) {
			throw q(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_FAILED", "firefox-tabs-context-menu-handoff", "nativeUi.beginPopupHandoff", e);
		}
		if (!n) throw q(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_REJECTED", "firefox-tabs-context-menu-handoff", "nativeUi.beginPopupHandoff");
		v = !0;
	}, N = () => {
		if (!v) return null;
		v = !1;
		try {
			return n(Ur), null;
		} catch (e) {
			return q(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_RELEASE_FAILED", "firefox-tabs-context-menu-handoff", "nativeUi.endPopupHandoff", e);
		}
	}, P = Object.freeze({
		close(e) {
			let t = A(e);
			j("removeTab", [t, {
				animate: !0,
				isUserTriggered: !0
			}]), O(!0);
		},
		move(e, n) {
			let r = A(e);
			if (!Number.isSafeInteger(n) || n < 0 || n > 1e4) throw q(t, "FENNEVIA_FIREFOX_TAB_MOVE_INDEX_INVALID", "firefox-tabs-action", "tabs.move.index");
			j("moveTabTo", [r, {
				isUserTriggered: !0,
				tabIndex: n
			}]), O(!0);
		},
		open(e) {
			let n = M(e), r = y().BROWSER_NEW_TAB_URL;
			if (typeof r != "string" || r.length === 0) throw q(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.BROWSER_NEW_TAB_URL");
			let i = Ir(t, j("addTrustedTab", [r, { inBackground: !n.selected }]));
			if (!C().includes(i)) throw q(t, "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED", "firefox-tabs-action", "window.gBrowser.addTrustedTab");
			let a = m.register(i);
			if (O(!0), n.selected && x().selectedTab !== i) throw q(t, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			return a;
		},
		openContextMenu(e, n) {
			let r = A(e), a = re(n), o = ie(), s = o.openPopup, c = o.moveTo;
			if (!Or(s) || !Or(c)) throw q(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
			try {
				j("translateTabContextMenu", []);
			} catch (e) {
				throw _(e) ? e : q(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_TRANSLATION_FAILED", "firefox-tabs-action", "window.gBrowser.translateTabContextMenu", e);
			}
			ae();
			try {
				Reflect.apply(s, o, [
					r,
					"after_start",
					0,
					0,
					!0
				]);
			} catch (e) {
				let n = N();
				throw n && i(n), q(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_REJECTED", "firefox-tabs-action", "document.tabContextMenu.openPopup", e);
			}
			try {
				Reflect.apply(c, o, [a.screenX, a.screenY]);
			} catch (e) {
				i(q(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POSITION_FAILED", "firefox-tabs-action", "document.tabContextMenu.moveTo", e));
			}
		},
		pin(e) {
			let n = A(e);
			if (!T(n, "pinned")) {
				if (j("pinTab", [n]), !T(n, "pinned")) throw q(t, "FENNEVIA_FIREFOX_TAB_PIN_REJECTED", "firefox-tabs-action", "window.gBrowser.pinTab");
				O(!0);
			}
		},
		select(e) {
			let n = A(e), r = x();
			if (r.selectedTab !== n) {
				if (!Reflect.set(r, "selectedTab", n) || r.selectedTab !== n) throw q(t, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
				O(!0);
			}
		},
		snapshot() {
			return y(), u;
		},
		subscribe(e) {
			if (y(), typeof e != "function") throw q(t, "FENNEVIA_FIREFOX_TABS_LISTENER_INVALID", "firefox-tabs-subscribe", "tabs.subscribe");
			return f.add(e), b(() => {
				f.delete(e);
			});
		},
		toggleMute(e) {
			let n = A(e), r = n.toggleMuteAudio;
			if (!Or(r)) throw q(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "MozTabbrowserTab.toggleMuteAudio");
			Reflect.apply(r, n, []), O(!0);
		},
		unpin(e) {
			let n = A(e);
			if (T(n, "pinned")) {
				if (j("unpinTab", [n]), T(n, "pinned")) throw q(t, "FENNEVIA_FIREFOX_TAB_UNPIN_REJECTED", "firefox-tabs-action", "window.gBrowser.unpinTab");
				O(!0);
			}
		}
	});
	try {
		t.assertRequiredCapabilities(), S(), O(!1);
		let e = x(), n = e.tabContainer;
		for (let e of br) p.push(t.subscribe(n, e, (t) => {
			if (!(s || c)) try {
				if (e === "TabAttrModified" && !zr(t)) return;
				O(!0);
			} catch (t) {
				k(t, e);
			}
		}));
		for (let n of xr) p.push(t.subscribe(e, n, () => {
			if (!(s || c)) try {
				O(!0);
			} catch (e) {
				k(e, n);
			}
		}));
		let r = jr(y(), "tabContextMenu");
		if (!Mr(r)) throw q(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "document.tabContextMenu.openPopup.moveTo");
		g = r, p.push(t.subscribe(r, "popupshown", (e) => {
			s || c || !Hr(e, r) || D(Object.freeze({
				open: !0,
				type: "context-menu"
			}));
		})), p.push(t.subscribe(r, "popuphidden", (e) => {
			if (!Hr(e, r)) return;
			let t = N();
			t && i(t), !s && D(Object.freeze({
				open: !1,
				type: "context-menu"
			}));
		}));
	} catch (e) {
		s = !0, o = null;
		let n;
		for (let e of p.reverse()) try {
			e();
		} catch (e) {
			n ??= e;
		}
		try {
			m.dispose();
		} catch (e) {
			n ??= e;
		}
		throw n !== void 0 && i(q(t, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", n)), e;
	}
	return Object.freeze({
		assertRequiredCapabilities: S,
		dispose() {
			if (s) return !1;
			s = !0, o = null;
			let e, n = g?.hidePopup;
			if (g && Or(n)) try {
				Reflect.apply(n, g, []);
			} catch (t) {
				e ??= t;
			}
			let r = N();
			r && (e ??= r), g = null, h = null;
			for (let t of p.reverse()) try {
				t();
			} catch (t) {
				e ??= t;
			}
			p.length = 0, f.clear(), d.clear(), u = Object.freeze([]);
			try {
				m.dispose();
			} catch (t) {
				e ??= t;
			}
			if (e !== void 0) throw q(t, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", e);
			return !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: s,
				failed: c !== null,
				revision: l,
				subscriberCount: f.size,
				tabCount: u.length
			});
		},
		tabs: P
	});
}
//#endregion
//#region src/firefox/toolbar-widgets/native-support.ts
var Gr = "nav-bar", Kr = "unified-extensions-area", qr = "fennevia.customize.layout", Jr = "fennevia.customize.style", Yr = "fennevia.customize.", Xr = "after_start", Zr = Object.freeze({ capture: !0 }), Qr = /^rgba?\([0-9\s.,%]{1,48}\)$/u, $r = /url\(\s*"((?:[^"\\]|\\.){1,512})"\s*\)/u, ei = /url\(\s*'((?:[^'\\]|\\.){1,512})'\s*\)/u, ti = /url\(\s*((?:[^"')\\]|\\.){1,512})\s*\)/u, ni = "moz-extension://", ri = "-browser-action", ii = /["'\\<>\s]/u, ai = /#([A-Za-z_][\w-]*)/gu, oi = /^(?:branding|browser|toolkit|preview)\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.ftl$/u, si = /^(?:[A-Za-z][\w-]*\.)?(?:label|tooltiptext\d*)$/u, ci = /%[0-9$]*[Ssd]/u, li = Object.freeze([
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
]), ui = new Set(li), di = new Map([
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
]), fi = Object.freeze([
	"browser/browser.ftl",
	"browser/sidebar.ftl",
	"browser/appmenu.ftl",
	"browser/screenshots.ftl"
]), pi = new Map([
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
]), mi = new Map([
	["bookmarks-menu-button", "chrome://browser/skin/bookmark-star-on-tray.svg"],
	["characterencoding-button", "chrome://browser/skin/characterEncoding.svg"],
	["developer-button", "chrome://global/skin/icons/developer.svg"],
	["email-link-button", "chrome://browser/skin/mail.svg"],
	["find-button", "chrome://global/skin/icons/search-glass.svg"],
	["firefox-view-button", "chrome://browser/skin/firefox-view.svg"],
	["fullscreen-button", "chrome://browser/skin/fullscreen.svg"],
	["ipprotection-button", "chrome://browser/content/ipprotection/assets/states/ipprotection-off.svg"],
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
	["share-tab-button", "chrome://browser/skin/share.svg"],
	["sidebar-button", "chrome://browser/skin/sidebar-collapsed.svg"],
	["sync-button", "chrome://browser/skin/synced-tabs.svg"],
	["tab-groups-button", "chrome://browser/skin/tabbrowser/tab-groups.svg"]
]), hi = (e, t) => e === "send-tab-button" ? Number.parseInt(t.split(".", 1)[0] ?? "", 10) >= 154 ? "chrome://browser/skin/send-tab.svg" : "chrome://browser/skin/send-tab-20.svg" : mi.get(e) ?? "", gi = new Map([
	["show-bookmarks", Object.freeze({
		icon: "bookmark",
		label: "Show bookmarks panel",
		tooltip: "Reveal the Fennevia bookmarks panel"
	})],
	["show-downloads", Object.freeze({
		icon: "download",
		label: "Open Firefox downloads",
		tooltip: "Open the Firefox downloads panel"
	})],
	["show-translate", Object.freeze({
		icon: "translate",
		label: "Translate this page",
		tooltip: "Open Firefox built-in translations"
	})]
]), J = (e) => typeof e == "object" && !!e, Y = (e) => typeof e == "function", _i = (e) => J(e) && Y(e.getAttribute), vi = (e) => J(e) && Y(e.hidePopup) && Y(e.moveToAnchor), yi = (e, t) => typeof e == "string" ? e.slice(0, t) : "", bi = (e) => {
	let t = e.trim();
	return Qr.test(t) ? t : "";
}, xi = (e) => {
	let t = e.CustomizableUI;
	return !J(t) || !Y(t.getWidgetIdsInArea) || !Y(t.getWidget) || !Y(t.addListener) || !Y(t.removeListener) ? null : t;
}, Si = (e) => {
	let t = e.Services;
	if (!J(t)) return null;
	let n = t.prefs;
	return !J(n) || !Y(n.addObserver) || !Y(n.clearUserPref) || !Y(n.getStringPref) || !Y(n.removeObserver) || !Y(n.setStringPref) ? null : n;
}, Ci = (e, t) => {
	try {
		let n = Reflect.apply(e.getStringPref, e, [t, ""]);
		return typeof n == "string" && n.length <= 16384 ? n : "";
	} catch {
		return "";
	}
}, wi = (e) => {
	try {
		let t = e.AREA_ADDONS;
		return typeof t == "string" && t !== "" ? t : Kr;
	} catch {
		return Kr;
	}
}, Ti = (e, t) => {
	if (Y(e.isWebExtensionWidget)) try {
		return Reflect.apply(e.isWebExtensionWidget, e, [t]) === !0;
	} catch {}
	return t.endsWith(ri);
}, Ei = (e) => {
	let t = e.PanelUI;
	return !J(t) || !Y(t.showSubView) ? null : t.showSubView;
}, Di = Object.freeze([
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.customizable-ui",
		read: (e) => xi(e),
		requirement: "optional",
		symbol: "window.CustomizableUI.getWidgetIdsInArea.getWidget.addListener.removeListener"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.panel-ui-sub-view",
		read: (e) => Ei(e),
		requirement: "optional",
		symbol: "window.PanelUI.showSubView"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.prefs",
		read: (e) => Si(e),
		requirement: "optional",
		symbol: "window.Services.prefs.getStringPref.setStringPref.clearUserPref.addObserver.removeObserver"
	}),
	Object.freeze({
		isAvailable: (e) => J(e) && Y(e.addEventListener) && Y(e.removeEventListener) && Y(e.getElementById),
		name: "toolbar-widgets.document-events",
		read: (e) => e.document,
		requirement: "required",
		symbol: "document.addEventListener.removeEventListener.getElementById"
	})
]), Oi = (e) => Object.freeze(Di.map((t) => {
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
})), ki = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, X = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: ki(e),
	phase: n,
	symbol: r
}), Ai = (e) => {
	if (e.startsWith("customizableui-special-")) {
		let t = /^customizableui-special-(spring|spacer|separator)/u.exec(e);
		return t ? t[1] : null;
	}
	return e === "spring" || e === "spacer" || e === "separator" ? e : e === "vertical-spacer" ? "spacer" : null;
}, ji = (e, t) => {
	if (!e) return "";
	try {
		let n = e[t];
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, Mi = (e, t) => {
	let n = e.document;
	if (!(!J(n) || !Y(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Ni = (e, t) => {
	if (Y(e.querySelector)) try {
		return Reflect.apply(e.querySelector, e, [t]);
	} catch {
		return;
	}
}, Pi = (e, t) => {
	try {
		let n = Reflect.apply(e.getAttribute, e, [t]);
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, Fi = (e) => {
	if (e === "" || e === "none") return "";
	let t = $r.exec(e);
	if (t) return t[1].replace(/\\(.)/gu, "$1");
	let n = ei.exec(e);
	if (n) return n[1].replace(/\\(.)/gu, "$1");
	let r = ti.exec(e);
	return r ? r[1].replace(/\\(.)/gu, "$1") : "";
}, Ii = (e, t) => e === "" || e.length > 512 || ii.test(e) ? !1 : t === "extension" ? e.startsWith(ni) : e.startsWith("chrome://") || e.startsWith("resource://"), Li = (e) => {
	if (_i(e)) return e;
	if (Array.isArray(e)) {
		let t = e[0];
		return _i(t) ? t : null;
	}
	if (!J(e)) return null;
	let t = e[0];
	if (_i(t)) return t;
	if (Y(e.item)) try {
		let t = Reflect.apply(e.item, e, [0]);
		return _i(t) ? t : null;
	} catch {
		return null;
	}
	return null;
}, Ri = (e) => {
	if (!J(e)) return "";
	try {
		let t = e.listStyleImage;
		if (typeof t == "string" && t !== "") {
			let e = Fi(t);
			if (e) return e;
		}
	} catch {}
	if (Y(e.getPropertyValue)) try {
		let t = Reflect.apply(e.getPropertyValue, e, ["list-style-image"]);
		if (typeof t == "string") return Fi(t);
	} catch {
		return "";
	}
	return "";
}, zi = (e) => {
	try {
		let t = e.style, n = Ri(t);
		if (n) return n;
	} catch {}
	return "";
}, Bi = (e) => {
	if (typeof e != "string" || e === "") return [];
	let t = [];
	ai.lastIndex = 0;
	for (let n of e.matchAll(ai)) {
		let e = n[1];
		e && t.push(e);
	}
	return t;
}, Vi = (e, t, n = []) => {
	if (!J(e)) return;
	let r;
	try {
		r = e.selectorText;
	} catch {
		r = void 0;
	}
	let i = Bi(r), a = i.length > 0 ? i : n, o = zi(e);
	if (o && Ii(o, "builtin")) for (let e of a) t.set(e, o);
	let s;
	try {
		s = e.cssRules;
	} catch {
		s = void 0;
	}
	if (J(s) && typeof s.length == "number") {
		let e = s.length;
		for (let n = 0; n < e; n += 1) Vi(s[n], t, a);
	}
}, Hi = (e, t) => {
	if (Array.isArray(e) || J(e)) return e[t];
}, Ui = (e, t) => {
	if (Array.isArray(e)) {
		for (let n of e) if (J(n) && n.name === t && typeof n.value == "string") return n.value;
		return "";
	}
	if (!J(e)) return "";
	if (typeof e.length == "number" && e.length > 0) {
		let n = e.length;
		for (let r = 0; r < n; r += 1) {
			let n = e[r];
			if (J(n) && n.name === t && typeof n.value == "string") return n.value;
		}
	}
	let n = e[t];
	return typeof n == "string" ? n : "";
}, Wi = (e, t) => {
	let n = Hi(e, 0);
	if (!J(n)) return "";
	let r = Ui(n.attributes, "label") || Ui(n.attributes, "tooltiptext"), i = typeof n.value == "string" ? n.value : "", a = r || i;
	return !a || a === t ? "" : yi(a, 200);
}, Gi = (e, t) => {
	if (Y(e.formatMessagesSync)) try {
		let n = Wi(Reflect.apply(e.formatMessagesSync, e, [[{ id: t }]]), t);
		if (n) return n;
	} catch {}
	if (!Y(e.formatValueSync)) return "";
	try {
		let n = Reflect.apply(e.formatValueSync, e, [t]);
		return typeof n != "string" || n === "" || n === t ? "" : yi(n, 200);
	} catch {
		return "";
	}
}, Ki = (e) => e.length > 0 && e.length <= 128 && !e.includes("..") && oi.test(e), qi = (e) => {
	let t = [], n = new Set(), r = (e) => {
		let r = e.trim();
		n.has(r) || !Ki(r) || t.length >= 48 || (n.add(r), t.push(r));
	};
	for (let e of fi) r(e);
	if (!Y(e.querySelectorAll)) return t;
	try {
		let t = Reflect.apply(e.querySelectorAll, e, ["link[rel=\"localization\"]"]), n = Array.isArray(t) || J(t) && typeof t.length == "number" ? t.length : 0;
		for (let e = 0; e < n; e += 1) {
			let n = Hi(t, e);
			_i(n) && r(Pi(n, "href"));
		}
	} catch {}
	return t;
}, Ji = (e, t = "") => t && (e === t || e.startsWith(`${t}.`)) ? !0 : si.test(e), Yi = (e, t, n = "") => !e || Ji(e, n) || ci.test(e) ? "" : yi(e, t), Xi = (e) => e.isConnected === !0, Zi = (e) => {
	let t = Ni(e, ".unified-extensions-item-action-button");
	return _i(t) ? t : null;
}, Qi = (e) => {
	let t = "", n = e.style;
	if (J(n) && Y(n.getPropertyValue)) try {
		let e = Reflect.apply(n.getPropertyValue, n, ["--webextension-toolbar-image"]);
		typeof e == "string" && (t = e);
	} catch {
		t = "";
	}
	t ||= Pi(e, "style");
	let r = Fi(t);
	return Ii(r, "extension") ? r : "";
}, $i = (e) => {
	let t = yi(Pi(e, "badge"), 8), n = "", r = "", i = Pi(e, "badgeStyle"), a = /background-color:\s*([^;]{1,64})/u.exec(i);
	a && (n = bi(a[1]));
	let o = /(?:^|;)\s*color:\s*([^;]{1,64})/u.exec(i);
	return o && (r = bi(o[1])), Object.freeze({
		background: n,
		text: t,
		textColor: r
	});
}, ea = (e) => {
	let t = Ni(e, ".unified-extensions-item-name");
	if (J(t) && typeof t.textContent == "string") {
		let e = t.textContent.trim();
		if (e) return yi(e, 200);
	}
	return "";
}, ta = (e) => e.disabled === !0 || Pi(e, "disabled") === "true";
//#endregion
//#region src/firefox/toolbar-widgets/popup-actions.ts
function na({ boundary: e, getWindowOrNull: t, isDisposed: n, onActionDelta: r, popupListeners: i, registry: a, requireProjectHost: o, requireWindow: s }) {
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
		if (r && Y(r.clearTimeout)) try {
			Reflect.apply(r.clearTimeout, r, [n.timeoutHandle]);
		} catch {}
		n.resolve(e);
	}, h = (e) => {
		let n = f;
		if (!n) return;
		f = null;
		let r = t();
		if (n.timeoutHandle !== void 0 && r && Y(r.clearTimeout)) try {
			Reflect.apply(r.clearTimeout, r, [n.timeoutHandle]);
		} catch {}
		n.resolve(e);
	}, g = (e, t) => {
		c = e, l = t, p(!0);
	}, v = () => {
		c && (c = null, l = "", p(!1));
	}, y = (e) => J(e) ? J(e.originalTarget) ? e.originalTarget : J(e.target) ? e.target : null : null, b = (e, t) => {
		if (t === e) return !0;
		if (!Y(e.contains)) return !1;
		try {
			return Reflect.apply(e.contains, e, [t]) === !0;
		} catch {
			return !1;
		}
	}, x = (e) => {
		if (n()) return;
		let t = y(e);
		if (!t || !vi(t)) return;
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
						Xr,
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
			Y(a) ? r.timeoutHandle = Reflect.apply(a, t, [i, 800]) : queueMicrotask(i);
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
			Y(s) ? a.timeoutHandle = Reflect.apply(s, r, [o, 800]) : queueMicrotask(o);
		});
	}, T = () => {
		let e = c;
		if (e) try {
			Reflect.apply(e.hidePopup, e, []);
		} catch {
			v();
		}
	}, ee = (t) => {
		if (Y(t.doCommand)) try {
			Reflect.apply(t.doCommand, t, []);
			return;
		} catch {}
		let n = s().CustomEvent;
		if (!Y(n) || !Y(t.dispatchEvent)) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command");
		let r = Reflect.construct(n, ["command", Object.freeze({
			bubbles: !0,
			cancelable: !0
		})]);
		Reflect.apply(t.dispatchEvent, t, [r]);
	}, E = (e) => {
		let t = xi(s()), n = typeof e.id == "string" ? e.id : "";
		if (!t || !n) return "";
		try {
			let e = Reflect.apply(t.getWidget, t, [n]);
			if (J(e) && typeof e.viewId == "string") return e.viewId;
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
			if (typeof t != "string" || t === "") throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.handle");
			let i = o(n), u = a.resolve(t);
			if (!Xi(u)) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE", "firefox-toolbar-widgets-action", "toolbar-widgets.native-node");
			r(1);
			try {
				if (c && l === t) return T(), !0;
				T();
				let n = s(), r = E(u), a = Ei(n);
				if (r && a) {
					try {
						i.open === !0 && (i.open = !1);
					} catch {}
					let o = C(t);
					try {
						let e = Reflect.apply(a, n.PanelUI, [r, i]);
						Promise.resolve(e).catch(() => {});
					} catch (t) {
						throw m(!1), d = "", X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.PanelUI.showSubView", t);
					}
					return await o;
				}
				let o = w(t, i, u);
				try {
					ee(u);
				} catch (t) {
					throw h(!1), _(t) ? t : X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command", t);
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
function ra({ boundary: e, frame: t, window: n }) {
	if (e.assertOwnsWindow(n), !J(n) || !J(t) || typeof t.contains != "function") throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_OPTIONS_INVALID", "firefox-toolbar-widgets-create", "window");
	let r = (e) => Reflect.apply(t.contains, t, [e]) === !0, i = n, a = !1, o = 0, s = 0, c = !1, l = !1, u = !1, d = "", f = dt(), p = null, m = nt(), h = 0, g = new Map(), v = new Map(), y = null, b = null, x, S = new Set(), C = [], w = new Set(), T = new Set(), ee = e.createHandleRegistry("toolbar-widget"), E = () => {
		if (a || !i) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_DISPOSED", "firefox-toolbar-widgets-access", "window");
		return i;
	}, te = () => {
		let t = Oi(E()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, D = na({
		boundary: e,
		getWindowOrNull: () => i,
		isDisposed: () => a,
		onActionDelta(e) {
			o += e;
		},
		popupListeners: T,
		registry: ee,
		requireProjectHost: (t) => {
			let n = E();
			if (!J(t) || !Y(t.getBoundingClientRect) || t.ownerDocument !== n.document || r(t) !== !0) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HOST_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.host");
			return t;
		},
		requireWindow: E
	}), { invoke: ne, onPopupHidden: O, onPopupShown: k } = D, A = e.snapshot().windowKind === "private", j = (e, t) => {
		try {
			let n = Reflect.apply(e.getWidget, e, [t]);
			return J(n) ? n : null;
		} catch {
			return null;
		}
	}, M = (e) => {
		let t = i;
		if (!t) return null;
		let n = t.gNavToolbox;
		if (!J(n)) return null;
		let r = n.palette;
		if (!J(r) || !Y(r.getElementsByAttribute)) return null;
		try {
			return Li(Reflect.apply(r.getElementsByAttribute, r, ["id", e]));
		} catch {
			return null;
		}
	}, re = (e) => {
		let t = i;
		if (!t) return null;
		let n = Mi(t, e);
		return _i(n) ? n : M(e);
	}, ie = () => {
		if (x !== void 0) return x;
		x = null;
		let e = i;
		if (!e || !Y(e.Localization)) return null;
		let t = e.document, n = J(t) ? qi(t) : [...fi];
		try {
			let t = Reflect.construct(e.Localization, [n, !0]);
			return !J(t) || !Y(t.formatMessagesSync) && !Y(t.formatValueSync) ? null : (x = t, t);
		} catch {
			return null;
		}
	}, ae = (e) => {
		if (!e) return "";
		let t = ie();
		if (t) {
			let n = Gi(t, e);
			if (n) return n;
		}
		let n = i;
		if (!n) return "";
		let r = n.document;
		if (!J(r)) return "";
		let a = r.l10n;
		return J(a) ? Gi(a, e) : "";
	}, N = (e, t, n) => {
		if (!Y(e.getLocalizedProperty)) return "";
		try {
			let r = Reflect.apply(e.getLocalizedProperty, e, [t, n]);
			return typeof r != "string" || r === "" ? "" : Yi(r, 200, t);
		} catch {
			return "";
		}
	}, P = (e, t, n, r, i) => {
		let a = r ? Yi(Pi(r, "label") || ji(r, "label"), 200, t) : "", o = r ? Yi(Pi(r, "title") || ji(r, "title"), 200, t) : "", s = r ? Yi(Pi(r, "tooltiptext") || ji(r, "tooltiptext"), 200, t) : "", c = Yi(ji(n, "label"), 200, t), l = Yi(ji(n, "tooltiptext"), 200, t), u = r ? ae(Pi(r, "data-l10n-id")) : "", d = ae(pi.get(t) ?? "");
		return a || o || c || u || N(e, t, "label") || d || s || l || N(e, t, "tooltiptext") || (i ? "Extension" : "Toolbar item");
	}, oe = (e, t, n, r) => {
		let i = n ? Yi(Pi(n, "tooltiptext") || ji(n, "tooltiptext"), 300, e) : "", a = n ? Yi(Pi(n, "title") || ji(n, "title"), 300, e) : "", o = Yi(ji(t, "tooltiptext"), 300, e);
		return i || a || o || r;
	}, se = () => {
		let e = new Map(), t = i;
		if (!t) return e;
		let n = t.document;
		if (!J(n)) return e;
		let r = n.styleSheets;
		if (!J(r) || typeof r.length != "number") return e;
		let a = r.length;
		for (let t = 0; t < a; t += 1) {
			let n;
			try {
				n = r[t];
			} catch {
				continue;
			}
			if (!J(n)) continue;
			let i;
			try {
				i = n.cssRules;
			} catch {
				continue;
			}
			if (!J(i) || typeof i.length != "number") continue;
			let a = i.length;
			for (let t = 0; t < a; t += 1) Vi(i[t], e);
		}
		return e;
	}, ce = (e) => (b ||= se(), b.get(e) ?? ""), le = (e) => {
		let t = i;
		if (!t || !Y(t.getComputedStyle)) return "";
		let n = [e], r = Ni(e, "toolbarbutton");
		_i(r) && n.unshift(r);
		for (let e of n) try {
			let n = Ri(Reflect.apply(t.getComputedStyle, t, [e]));
			if (Ii(n, "builtin")) return n;
		} catch {}
		return "";
	}, ue = (t, n) => {
		if (n) {
			let e = le(n);
			if (e) return e;
		}
		let r = ce(t);
		if (r) return r;
		let i = hi(t, e.snapshot().firefoxVersion);
		return Ii(i, "builtin") ? i : "";
	}, de = (e) => Object.freeze({
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
	}), fe = (e) => {
		let t = gi.get(e);
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
	}, pe = (e, t) => {
		let n = j(e, t), r = n?.webExtension === !0 || Ti(e, t), i = re(t), a = P(e, t, n, i, r), o = "";
		if (r && i) {
			let e = Zi(i);
			o = e ? Qi(e) : "";
		} else r || (o = ue(t, i));
		return Object.freeze({
			badgeBackground: "",
			badgeText: "",
			badgeTextColor: "",
			disabled: !0,
			fenneviaAction: "",
			handle: "",
			icon: r ? "extension" : di.get(t) ?? "generic",
			iconUrl: o,
			kind: r ? "extension-action" : "built-in",
			label: a,
			missing: !0,
			tooltip: oe(t, n, i, a)
		});
	}, me = (e, t) => {
		let n = Mi(E(), t);
		if (!_i(n) || !Xi(n)) return Object.freeze({
			node: null,
			widget: pe(e, t)
		});
		let r = j(e, t), i = r?.webExtension === !0 || Ti(e, t), a = ee.register(n);
		if (i) {
			let i = Zi(n), o = i ? $i(i) : Object.freeze({
				background: "",
				text: "",
				textColor: ""
			}), s = ea(n) || P(e, t, r, n, !0);
			return Object.freeze({
				node: n,
				widget: Object.freeze({
					badgeBackground: o.background,
					badgeText: o.text,
					badgeTextColor: o.textColor,
					disabled: ta(i || n),
					fenneviaAction: "",
					handle: a,
					icon: "extension",
					iconUrl: i ? Qi(i) : "",
					kind: "extension-action",
					label: s,
					missing: !1,
					tooltip: oe(t, r, n, s)
				})
			});
		}
		let o = P(e, t, r, n, !1);
		return Object.freeze({
			node: n,
			widget: Object.freeze({
				badgeBackground: "",
				badgeText: "",
				badgeTextColor: "",
				disabled: ta(n),
				fenneviaAction: "",
				handle: a,
				icon: di.get(t) ?? "generic",
				iconUrl: ue(t, n),
				kind: "built-in",
				label: o,
				missing: !1,
				tooltip: oe(t, r, n, o)
			})
		});
	}, he = (e, t) => t.type === "special" ? Object.freeze({
		node: null,
		widget: de(t.kind)
	}) : t.type === "fennevia" ? Object.freeze({
		node: null,
		widget: fe(t.id)
	}) : me(e, t.id), ge = (e) => {
		let t;
		try {
			t = Reflect.apply(e.getWidgetIdsInArea, e, [Gr]);
		} catch {
			t = null;
		}
		let n = [];
		if (Array.isArray(t)) for (let e of t) {
			if (typeof e != "string" || ui.has(e)) continue;
			let t = Ai(e);
			if (t) {
				n.push(Object.freeze({
					kind: t,
					type: "special"
				}));
				continue;
			}
			bt(e) && n.push(Object.freeze({
				id: e,
				type: "widget"
			}));
		}
		return Tt({ top: n });
	}, _e = (e) => {
		let t = g.get(e);
		if (t) return t;
		let n = `palette-${++h}`;
		return g.set(e, n), n;
	}, ve = (e) => {
		let t;
		try {
			t = e.areas;
		} catch {
			t = void 0;
		}
		let n = Array.isArray(t) ? t : [Gr], r = [], i = new Set();
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
	}, F = (e) => {
		if (!Y(e.getUnusedWidgets)) return [];
		let t = i?.gNavToolbox, n = J(t) ? t.palette : void 0;
		if (!J(n)) return [];
		try {
			let t = Reflect.apply(e.getUnusedWidgets, e, [n]);
			if (!Array.isArray(t)) return [];
			let r = [];
			for (let e of t) J(e) && typeof e.id == "string" && r.push(e.id);
			return r;
		} catch {
			return [];
		}
	}, I = (e, t) => {
		if (ui.has(t) || Ai(t) !== null || !bt(t)) return null;
		let n = j(e, t);
		if (A && n?.showInPrivateBrowsing === !1) return null;
		let r = n?.webExtension === !0 || Ti(e, t), i = re(t), a = _i(i) && Xi(i) ? i : null, o, s;
		if (r) {
			let r = a ? Zi(a) : i ? Zi(i) : null;
			s = r ? Qi(r) : "", o = (a ? ea(a) : "") || P(e, t, n, i, !0);
		} else o = P(e, t, n, i, !1), s = ue(t, i);
		let c = _e(`w:${t}`);
		return v.set(c, Object.freeze({
			id: t,
			type: "widget"
		})), Object.freeze({
			icon: r ? "extension" : di.get(t) ?? "generic",
			iconUrl: s,
			kind: r ? "extension-action" : "built-in",
			label: o,
			token: c
		});
	}, ye = (e, t) => {
		v.clear();
		let n = [], r = new Set(), i = new Set();
		for (let e of Le) for (let n of t.zones[e]) n.type === "widget" ? r.add(n.id) : n.type === "fennevia" && i.add(n.id);
		for (let e of Re) {
			if (i.has(e)) continue;
			let t = gi.get(e), r = _e(`f:${e}`);
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
		let a = [...ve(e), ...F(e)], o = new Set();
		for (let t of a) {
			if (o.has(t) || r.has(t) || n.length >= 256) continue;
			o.add(t);
			let i = I(e, t);
			i && n.push(i);
		}
		for (let [e, t] of [
			["separator", "Separator"],
			["spacer", "Space"],
			["spring", "Flexible space"]
		]) {
			let r = _e(`s:${e}`);
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
	}, be = (e) => {
		if (J(y) && Y(y.disconnect)) try {
			Reflect.apply(y.disconnect, y, []);
		} catch {}
		y = null;
		let t = i;
		if (!t) return;
		let n = t.MutationObserver;
		if (Y(n)) try {
			let t = Reflect.construct(n, [() => {
				R();
			}]);
			if (!Y(t.observe)) return;
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
	}, xe = () => {
		let e = E(), t = xi(e);
		if (!t) return v.clear(), be([]), Object.freeze({
			serialized: "unavailable",
			snapshot: dt()
		});
		let n = p ?? ge(t), r = [], i = [], a = new Set();
		for (let e of Le) {
			let o = [];
			for (let r of n.zones[e]) {
				let e = he(t, r);
				o.push(e.widget), i.push(e.node), e.widget.handle !== "" && a.add(e.widget.handle);
			}
			r.push([e, Object.freeze(o)]);
		}
		for (let e of S) if (!a.has(e)) try {
			ee.release(e);
		} catch {}
		S.clear();
		for (let e of a) S.add(e);
		be(i);
		let o = Si(e), s = Object.freeze({
			available: !0,
			canEdit: o !== null,
			layoutCustomized: p !== null,
			palette: ye(t, n),
			style: ct(m),
			zones: Object.freeze(Object.fromEntries(r))
		});
		return Object.freeze({
			serialized: JSON.stringify(s),
			snapshot: s
		});
	}, L = () => {
		if (a) return;
		let e = xe();
		if (e.serialized === d) return;
		d = e.serialized, f = e.snapshot, s += 1;
		let t = Object.freeze({
			revision: s,
			snapshot: f,
			type: "snapshot"
		});
		for (let e of Array.from(w)) e(t);
	}, R = () => {
		if (a || c) return;
		c = !0;
		let e = () => {
			c = !1, !a && L();
		}, t = i, n = t?.setTimeout;
		if (t && Y(n)) {
			Reflect.apply(n, t, [e, 0]);
			return;
		}
		queueMicrotask(e);
	}, Se = Object.freeze({
		onAreaReset: () => R(),
		onCustomizeEnd: () => R(),
		onWidgetAdded: () => R(),
		onWidgetCreated: () => R(),
		onWidgetDestroyed: () => R(),
		onWidgetInstanceRemoved: () => R(),
		onWidgetMoved: () => R(),
		onWidgetOverflow: () => R(),
		onWidgetRemoved: () => R(),
		onWidgetReset: () => R(),
		onWidgetUndoMove: () => R(),
		onWidgetUnderflow: () => R()
	}), Ce = () => {
		if (!l) return;
		l = !1;
		let e = i;
		if (!e) return;
		let t = xi(e);
		if (t) try {
			Reflect.apply(t.removeListener, t, [Se]);
		} catch {}
	}, z = () => {
		let e = i;
		if (!e) return;
		let t = Si(e);
		if (!t) {
			p = null, m = nt();
			return;
		}
		p = Et(Ci(t, qr)), m = Ot(Ci(t, "fennevia.customize.style")) ?? nt();
	}, we = Object.freeze({ observe: () => {
		a || (z(), R());
	} }), B = () => {
		if (!u) return;
		u = !1;
		let e = i, t = e ? Si(e) : null;
		if (t) try {
			Reflect.apply(t.removeObserver, t, [Yr, we]);
		} catch {}
	}, Te = () => {
		let t = Si(E());
		if (!t) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.Services.prefs");
		return t;
	}, Ee = (e) => {
		let t = Te();
		Reflect.apply(t.setStringPref, t, [qr, Dt(e)]), p = e;
	}, De = (e) => {
		let t = Te();
		Reflect.apply(t.setStringPref, t, [Jr, kt(e)]), m = e;
	}, V = (t, n, r) => {
		let i = "";
		if (Y(t.getPlacementOfWidget)) try {
			let e = Reflect.apply(t.getPlacementOfWidget, t, [r]);
			J(e) && typeof e.area == "string" && (i = e.area);
		} catch {
			i = "";
		}
		if (i !== "" && i !== wi(t)) return n;
		if (!Y(t.addWidgetToArea)) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI.addWidgetToArea");
		return Reflect.apply(t.addWidgetToArea, t, [r, Gr]), Rt(n, r);
	}, Oe = (e, t, n) => {
		if (!t.adopted.includes(n)) return t;
		if (Ti(e, n)) {
			if (Y(e.addWidgetToArea)) try {
				Reflect.apply(e.addWidgetToArea, e, [n, wi(e)]);
			} catch {}
		} else if (Y(e.removeWidgetFromArea)) try {
			Reflect.apply(e.removeWidgetFromArea, e, [n]);
		} catch {}
		return zt(t, n);
	}, ke = () => {
		let t = xi(E());
		if (!t) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI");
		return t;
	}, Ae = Object.freeze({
		edit: async (t) => {
			E();
			let n;
			try {
				n = mt(t);
			} catch (t) {
				throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
			}
			o += 1;
			try {
				if (n.type === "set-style") return De(ct({
					...m,
					...n.style
				})), L(), !0;
				if (n.type === "reset-style") {
					let e = Te();
					try {
						Reflect.apply(e.clearUserPref, e, [Jr]);
					} catch {}
					return m = nt(), L(), !0;
				}
				let t = ke();
				if (Te(), n.revision !== s) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_STALE", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit-revision");
				let r = p ?? ge(t);
				try {
					switch (n.type) {
						case "add": {
							let i = v.get(n.token);
							if (!i) throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.palette-token");
							let a = r;
							i.type === "widget" && (a = V(t, a, i.id)), a = Pt(a, i, n.zone, n.index), Ee(a);
							break;
						}
						case "move":
							Ee(Lt(r, n.fromZone, n.fromIndex, n.toZone, n.toIndex));
							break;
						case "remove": {
							let e = It(r, n.zone, n.index), i = Ft(r, n.zone, n.index);
							e.type === "widget" && !Bt(i, e.id) && (i = Oe(t, i, e.id)), Ee(i);
							break;
						}
						case "reset-layout": {
							let e = r;
							for (let n of [...r.adopted]) e = Oe(t, e, n);
							let n = Te();
							try {
								Reflect.apply(n.clearUserPref, n, [qr]);
							} catch {}
							p = null;
							break;
						}
					}
				} catch (t) {
					throw _(t) ? t : X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_FAILED", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
				}
				return L(), !0;
			} finally {
				--o;
			}
		},
		invoke: ne,
		snapshot() {
			E();
			let e = xe();
			return d = e.serialized, f = e.snapshot, f;
		},
		subscribe(t) {
			if (E(), typeof t != "function") throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			w.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, w.delete(t), !0) : !1);
		},
		subscribePopup(t) {
			if (E(), typeof t != "function") throw X(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			T.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, T.delete(t), !0) : !1);
		}
	});
	try {
		te();
		let t = E().document;
		C.push(e.subscribe(t, "popupshown", k, Zr), e.subscribe(t, "popuphidden", O, Zr));
		let n = xi(E());
		n && (Reflect.apply(n.addListener, n, [Se]), l = !0);
		let r = Si(E());
		r && (Reflect.apply(r.addObserver, r, [Yr, we]), u = !0), z();
		let i = xe();
		d = i.serialized, f = i.snapshot;
	} catch (e) {
		a = !0, B(), x = null, i = null;
		for (let e of C.reverse()) try {
			e();
		} catch {}
		throw C.length = 0, e;
	}
	return Object.freeze({
		assertRequiredCapabilities: te,
		dispose() {
			if (a) return !1;
			if (a = !0, D.dispose(), Ce(), B(), J(y) && Y(y.disconnect)) try {
				Reflect.apply(y.disconnect, y, []);
			} catch {}
			y = null, w.clear(), T.clear(), S.clear(), g.clear(), v.clear(), b = null, x = null, ee.dispose(), i = null;
			for (let e of C.reverse()) try {
				e();
			} catch {}
			return C.length = 0, !0;
		},
		refresh() {
			return !a && (L(), !0);
		},
		snapshot() {
			return Object.freeze({
				disposed: a,
				pendingActionCount: o,
				revision: s,
				widgetCount: Le.reduce((e, t) => e + f.zones[t].length, 0)
			});
		},
		toolbarWidgets: Ae
	});
}
//#endregion
//#region src/app/urlbar-coverage-state.ts
var ia = Object.freeze([
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
]), aa = Object.freeze([
	"location",
	"media",
	"serial",
	"xr"
]), oa = Object.freeze([
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
new Set(ia), new Set(aa), new Set(oa);
//#endregion
//#region src/firefox/urlbar-coverage/support.ts
var sa = Object.freeze([
	"blocked-permissions-container",
	"identity-permission-box",
	"page-action-buttons"
]), ca = Object.freeze({
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
}), la = Object.freeze([
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
]), ua = Object.freeze([
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
]), da = new Set([
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
]), fa = (e) => typeof e == "object" && !!e, pa = (e) => typeof e == "function", ma = (e) => fa(e) && pa(e.getAttribute) && pa(e.hasAttribute), ha = (e) => fa(e) && pa(e.getElementById), ga = (e) => ha(e.document) ? e.document : null, _a = (e, t) => {
	let n = ga(e);
	return n ? Reflect.apply(n.getElementById, n, [t]) : void 0;
}, va = (e) => ga(e)?.documentElement, ya = Object.freeze([
	Object.freeze({
		isAvailable: pa,
		name: "firefox.urlbar-coverage-native-access",
		read: (e) => e.openLocation,
		symbol: "window.openLocation"
	}),
	Object.freeze({
		isAvailable: pa,
		name: "firefox.urlbar-coverage-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: ma,
		name: "firefox.urlbar-coverage-urlbar-state",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.hasAttribute"
	}),
	Object.freeze({
		isAvailable: ma,
		name: "firefox.urlbar-coverage-window-state",
		read: va,
		symbol: "document.documentElement.hasAttribute"
	}),
	...sa.map((e) => Object.freeze({
		isAvailable: ma,
		name: `firefox.urlbar-coverage-${e}`,
		read: (t) => _a(t, e),
		symbol: `document.elements[${e}]`
	}))
]), ba = (e, t) => Object.freeze([...ya.map((t) => {
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
	available: pa(t),
	name: "firefox.urlbar-coverage-native-ui-handoff",
	requirement: "required",
	symbol: "nativeUi.revealForUrlbar"
}) })]), xa = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Sa = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: xa(e),
	phase: n,
	symbol: r
}), Ca = (e, t) => {
	let n = Reflect.apply(e.getAttribute, e, [t]);
	return typeof n == "string" ? n : null;
}, wa = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), Ta = (e) => {
	if (e.hidden === !0) return !1;
	let t = Ca(e, "hidden");
	return t !== null && t !== "false" ? !1 : Ca(e, "collapsed") !== "true";
}, Ea = (e) => {
	let t = e.children;
	return Object.freeze(!t || typeof t != "object" && !Array.isArray(t) ? [] : Array.from(t));
}, Da = (e, t) => {
	let n = e.classList;
	return fa(n) && pa(n.contains) && !!Reflect.apply(n.contains, n, [t]);
}, Oa = (e, t) => e.permissions.available === t.permissions.available && e.permissions.hasPermissions === t.permissions.hasPermissions && e.permissions.blocked.length === t.permissions.blocked.length && e.permissions.blocked.every((e, n) => e === t.permissions.blocked[n]) && e.permissions.sharing.length === t.permissions.sharing.length && e.permissions.sharing.every((e, n) => e === t.permissions.sharing[n]) && e.items.length === t.items.length && e.items.every((e, n) => e === t.items[n]);
//#endregion
//#region src/firefox/urlbar-coverage/controller.ts
function ka({ boundary: e, onError: t, requestNativeUiReveal: n, window: r }) {
	if (e.assertOwnsWindow(r), !fa(r) || typeof t != "function" || typeof n != "function") throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_OPTIONS_INVALID", "firefox-urlbar-coverage-create", "window");
	let i = r, a = !1, o = null, s = 0, c = null, l = Object.freeze({
		items: Object.freeze([]),
		permissions: Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		})
	}), u = new Set(), d = () => {
		if (a || !i) throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSED", "firefox-urlbar-coverage-access", "window.gURLBar");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, f = (t) => {
		let n = _a(d(), t);
		if (!ma(n)) throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", `document.elements[${t}]`);
		return n;
	}, p = () => {
		let t = d().gURLBar;
		if (!ma(t)) throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "window.gURLBar.hasAttribute");
		return t;
	}, m = () => {
		let t = va(d());
		if (!ma(t)) throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "document.documentElement.hasAttribute");
		return t;
	}, h = () => {
		let t = ba(d(), n), r = t.find((e) => !e.snapshot.available);
		if (r) throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-capability", r.snapshot.symbol, r.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, g = () => {
		let e = p(), t = f("identity-permission-box"), n = Object.freeze(la.flatMap(({ id: e, kind: t }) => {
			let n = _a(d(), e);
			return ma(n) && wa(n, "sharing") ? [t] : [];
		}));
		if (!(Ca(e, "pageproxystate") === "valid" || wa(e, "persistsearchterms") || n.length > 0)) return Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		});
		let r = Object.freeze(Ea(f("blocked-permissions-container")).flatMap((e) => {
			if (!ma(e) || !wa(e, "showing")) return [];
			let t = Ca(e, "data-permission-id"), n = t ? ca[t] : void 0;
			return n ? [n] : [];
		}));
		return Object.freeze({
			available: !0,
			blocked: r,
			hasPermissions: wa(t, "hasPermissions"),
			sharing: n
		});
	}, v = () => {
		let e = d(), t = p(), n = new Set();
		wa(m(), "remotecontrol") && n.add("remote-control"), wa(t, "searchmode") && n.add("search-mode"), wa(t, "persistsearchterms") && n.add("persisted-search");
		for (let { id: t, kind: r } of ua) {
			let i = _a(e, t);
			ma(i) && Ta(i) && n.add(r);
		}
		let r = _a(e, "pageActionButton");
		ma(r) && wa(r, "multiple-children") && n.add("more-page-actions");
		for (let e of Ea(f("page-action-buttons"))) {
			if (!ma(e) || !Ta(e) || !Da(e, "urlbar-page-action")) continue;
			let t = typeof e.id == "string" ? e.id : "";
			da.has(t) || (Da(e, "urlbar-addon-page-action") ? n.add("extension-actions") : wa(e, "actionid") && n.add("other-page-actions"));
		}
		return Object.freeze(oa.filter((e) => n.has(e)));
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
			t(Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED", "firefox-urlbar-coverage-notify", "urlbarCoverage.subscribe", n));
		}
	}, S = (e) => {
		let t = y();
		return Oa(l, t) && s > 0 ? !1 : (l = t, s += 1, e && x(), !0);
	}, C = (n) => {
		o = _(n) ? n : Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_EVENT_FAILED", "firefox-urlbar-coverage-event", "window.MutationObserver", n), t(o);
	}, w = Object.freeze({
		openNativeUrlbar() {
			let t = d(), r = t.openLocation;
			if (!pa(r)) throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-native-access", "window.openLocation");
			try {
				if (n() !== !0) throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_UI_HANDOFF_REJECTED", "firefox-urlbar-native-access", "nativeUi.revealForUrlbar");
				return Reflect.apply(r, t, []), !0;
			} catch (t) {
				throw _(t) ? t : Sa(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_ACCESS_FAILED", "firefox-urlbar-native-access", "window.openLocation", t);
			}
		},
		snapshot() {
			return d(), l;
		},
		subscribe(t) {
			if (d(), typeof t != "function") throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_LISTENER_INVALID", "firefox-urlbar-coverage-subscribe", "urlbarCoverage.subscribe");
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
			t(Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", n));
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
			if (c = null, u.clear(), i = null, t !== void 0) throw Sa(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", t);
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
//#region src/app/urlbar-suggestions-state.ts
var Aa = 1024, ja = 2048, Ma = Object.freeze([
	"tab-switch",
	"search",
	"url",
	"keyword",
	"omnibox",
	"remote-tab",
	"tip",
	"dynamic",
	"restrict",
	"ai-chat",
	"unknown"
]), Na = Object.freeze([
	"bookmarks",
	"history",
	"search",
	"tabs",
	"other-local",
	"other-network",
	"addon",
	"actions",
	"unknown"
]), Pa = Object.freeze(["direct", "native"]), Fa = Object.freeze([
	"idle",
	"querying",
	"results",
	"empty",
	"failed"
]);
new Set(Ma), new Set(Na), new Set(Pa), new Set(Fa);
function Ia(e) {
	let t = Error(e);
	return t.name = "FenneviaUrlbarSuggestionsStateError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "urlbar-suggestions-state"
		}
	}), t;
}
function La(e) {
	if (!e || typeof e != "object" || e.kind !== "keyboard" && e.kind !== "pointer" || e.button !== 0 && e.button !== 1 || typeof e.altKey != "boolean" || typeof e.ctrlKey != "boolean" || typeof e.metaKey != "boolean" || typeof e.shiftKey != "boolean" || e.kind === "keyboard" && e.button !== 0) throw Ia("FENNEVIA_URLBAR_SUGGESTIONS_GESTURE_INVALID");
	return Object.freeze({
		altKey: e.altKey,
		button: e.button,
		ctrlKey: e.ctrlKey,
		kind: e.kind,
		metaKey: e.metaKey,
		shiftKey: e.shiftKey
	});
}
//#endregion
//#region src/firefox/urlbar-suggestions/support.ts
var Z = Object.freeze({
	TAB_SWITCH: 1,
	SEARCH: 2,
	URL: 3,
	KEYWORD: 4,
	OMNIBOX: 5,
	REMOTE_TAB: 6,
	TIP: 7,
	DYNAMIC: 8,
	RESTRICT: 9,
	AI_CHAT: 10
}), Ra = Object.freeze({
	BOOKMARKS: 1,
	HISTORY: 2,
	SEARCH: 3,
	TABS: 4,
	OTHER_LOCAL: 5,
	OTHER_NETWORK: 6,
	ADDON: 7,
	ACTIONS: 8
}), za = Object.freeze({
	[Z.TAB_SWITCH]: "tab-switch",
	[Z.SEARCH]: "search",
	[Z.URL]: "url",
	[Z.KEYWORD]: "keyword",
	[Z.OMNIBOX]: "omnibox",
	[Z.REMOTE_TAB]: "remote-tab",
	[Z.TIP]: "tip",
	[Z.DYNAMIC]: "dynamic",
	[Z.RESTRICT]: "restrict",
	[Z.AI_CHAT]: "ai-chat"
}), Ba = Object.freeze({
	[Ra.BOOKMARKS]: "bookmarks",
	[Ra.HISTORY]: "history",
	[Ra.SEARCH]: "search",
	[Ra.TABS]: "tabs",
	[Ra.OTHER_LOCAL]: "other-local",
	[Ra.OTHER_NETWORK]: "other-network",
	[Ra.ADDON]: "addon",
	[Ra.ACTIONS]: "actions"
}), Va = new Set([
	Z.TAB_SWITCH,
	Z.SEARCH,
	Z.URL,
	Z.KEYWORD,
	Z.OMNIBOX,
	Z.REMOTE_TAB
]), Q = (e) => typeof e == "object" && !!e || typeof e == "function", Ha = (e) => typeof e == "function", Ua = (e) => typeof e == "function", Wa = (e) => Q(e) && Ha(e.close) && Ha(e.telemetryTypeFromElement), Ga = (e) => Q(e) && typeof e.value == "string" && Q(e.controller) && Wa(e.view) && Ha(e.startQuery) && Ha(e.pickResult) && Ha(e.handleRevert), Ka = (e) => {
	let t = e.parentController;
	return Q(t) ? t : e;
}, qa = (e) => Q(e) && Ha(e.startQuery) && Ha(e.cancelQuery), Ja = (e) => {
	let t = e.gURLBar, n = e.gBrowser;
	if (!Ga(t) || !Q(n)) return null;
	let r = t.controller, i = Ka(r), a = i.manager, o = n.selectedBrowser;
	return !qa(a) || !Q(o) ? null : Object.freeze({
		input: t,
		manager: a,
		nativeController: r,
		parentController: i,
		selectedBrowser: o
	});
}, Ya = Object.freeze([
	Object.freeze({
		isAvailable: Ga,
		name: "firefox.urlbar-suggestions-input",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.startQuery"
	}),
	Object.freeze({
		isAvailable: (e) => Q(e) ? qa(Ka(e).manager) : !1,
		name: "firefox.urlbar-suggestions-manager",
		read: (e) => Q(e.gURLBar) ? e.gURLBar.controller : void 0,
		symbol: "window.gURLBar.controller.parentController.manager.startQuery"
	}),
	Object.freeze({
		isAvailable: Q,
		name: "firefox.urlbar-suggestions-selected-browser",
		read: (e) => Q(e.gBrowser) ? e.gBrowser.selectedBrowser : void 0,
		symbol: "window.gBrowser.selectedBrowser"
	}),
	Object.freeze({
		isAvailable: Ua,
		name: "firefox.urlbar-suggestions-keyboard-event",
		read: (e) => e.KeyboardEvent,
		symbol: "window.KeyboardEvent"
	}),
	Object.freeze({
		isAvailable: Ua,
		name: "firefox.urlbar-suggestions-mouse-event",
		read: (e) => e.MouseEvent,
		symbol: "window.MouseEvent"
	})
]), Xa = (e) => Object.freeze(Ya.map((t) => {
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
})), Za = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, $ = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Za(e),
	phase: n,
	symbol: r
}), Qa = (e, t) => {
	if (typeof e != "string") return "";
	let n = "";
	for (let r of e.slice(0, t)) {
		let e = r.charCodeAt(0);
		n += e <= 8 || e === 11 || e === 12 || e >= 14 && e <= 31 || e === 127 ? " " : r;
	}
	return n;
}, $a = (e) => Q(e.payload) ? e.payload : Object.create(null), eo = (e, t, n = !1) => {
	if (!Ha(e.getDisplayableValueAndHighlights)) return "";
	try {
		let r = Reflect.apply(e.getDisplayableValueAndHighlights, e, [t, ...n ? [{ isURL: !0 }] : []]);
		return Q(r) ? Qa(r.value, 2048) : "";
	} catch {
		return "";
	}
}, to = (e, t) => {
	for (let n of e) {
		let e = Qa(n, t);
		if (e.length > 0) return e;
	}
	return "";
}, no = (e) => {
	let t;
	try {
		t = e.icon;
	} catch {
		return null;
	}
	if (typeof t != "string" || t.length === 0 || t.length > 2048) return null;
	let n = Qa(t, ja);
	return n === t && (/^(?:chrome|resource|moz-extension|page-icon|moz-page-thumb):/iu.test(n) || /^data:image\/(?:png|gif|jpeg|webp);base64,[a-z0-9+/=]+$/iu.test(n)) ? n : null;
}, ro = (e) => Number.isInteger(e) ? za[e] ?? "unknown" : "unknown", io = (e) => Number.isInteger(e) ? Ba[e] ?? "unknown" : "unknown", ao = (e) => Number.isInteger(e.type) && Va.has(e.type) ? "direct" : "native", oo = (e, t) => {
	let n = $a(e), r = eo(e, "title"), i = eo(e, "url", !0), a = to([
		n.text,
		r,
		n.title,
		n.suggestion,
		n.query,
		n.input,
		i,
		n.url
	], 512), o = to([
		n.description,
		n.subtitle,
		n.device,
		n.engine,
		n.content,
		i === a ? "" : i
	], Aa);
	return Object.freeze({
		description: o,
		execution: ao(e),
		heuristic: e.heuristic === !0,
		icon: no(e),
		source: io(e.source),
		title: a,
		token: t,
		type: ro(e.type)
	});
};
//#endregion
//#region src/firefox/urlbar-suggestions/controller.ts
function so({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !Q(n) || typeof t != "function") throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_OPTIONS_INVALID", "firefox-urlbar-suggestions-create", "window.gURLBar");
	let r = n, i = !1, a = 0, o = 0, s = null, c = Object.freeze({
		available: !0,
		phase: "idle",
		queryRevision: 0,
		results: Object.freeze([])
	}), l = new Set(), u = e.createHandleRegistry("urlbar-result"), d = new Map(), f = () => {
		if (i || !r) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_DISPOSED", "firefox-urlbar-suggestions-access", "window.gURLBar");
		return e.assertOwnsWindow(r), r;
	}, p = () => {
		let t = Xa(f()), n = t.find((e) => !e.snapshot.available);
		if (n) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, m = () => {
		let t = Ja(f());
		if (!t) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-access", "window.gURLBar.controller.parentController.manager");
		return t;
	}, h = () => {
		let n = Object.freeze({
			revision: a,
			snapshot: c,
			type: "snapshot"
		});
		for (let r of Array.from(l)) try {
			r(n);
		} catch (n) {
			t($(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_SUBSCRIBER_FAILED", "firefox-urlbar-suggestions-notify", "urlbarSuggestions.subscribe", n));
		}
	}, g = (e, t = Object.freeze([])) => {
		c = Object.freeze({
			available: !0,
			phase: e,
			queryRevision: o,
			results: Object.freeze([...t])
		}), a += 1, h();
	}, _ = () => {
		for (let e of d.keys()) try {
			u.release(e);
		} catch {}
		d.clear();
	}, v = (n) => {
		if (!n) return !1;
		s === n && (s = null);
		try {
			Reflect.apply(n.manager.cancelQuery, n.manager, [n.context]);
		} catch (n) {
			t($(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CANCEL_FAILED", "firefox-urlbar-suggestions-cancel", "UrlbarProvidersManager.cancelQuery", n));
		}
		return !0;
	}, y = (n, r, i, a, o) => {
		n && s !== n || (v(n ?? s), _(), g("failed"), t($(e, r, i, a, o)));
	}, x = (e, t, n) => {
		let r = s;
		if (i || !r || r.context !== e || r.revision !== n || o !== n) return;
		let a = Array.isArray(e.results) ? e.results.slice(0, 20) : [], c = [], l = new Set();
		_();
		for (let e of a) {
			if (!Q(e) || l.has(e)) continue;
			l.add(e);
			let r = e, i = u.register(r), a;
			try {
				a = oo(r, i);
			} catch (e) {
				throw u.release(i), e;
			}
			d.set(i, Object.freeze({
				execution: a.execution,
				input: t.input,
				manager: t.manager,
				queryRevision: n,
				result: r
			})), c.push(a);
		}
		c.length > 0 ? g("results", c) : g("querying");
	}, S = (e, t, n) => {
		let r = Object.freeze({
			get isOpen() {
				return !1;
			},
			get selectedElement() {
				return null;
			},
			get selectedResult() {
				return null;
			},
			get visibleResults() {
				return Array.isArray(t.results) ? t.results : [];
			}
		});
		return new Proxy(e.parentController, { get(i, a) {
			if (a === "receiveResults") return (r) => {
				if (r === t) try {
					x(t, e, n);
				} catch (e) {
					y(s, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_RESULT_FAILED", "firefox-urlbar-suggestions-result", "UrlbarParentController.receiveResults", e);
				}
			};
			if (a === "view") return r;
			let o = Reflect.get(i, a, i);
			return Ha(o) ? o.bind(i) : o;
		} });
	}, C = (n) => {
		try {
			Reflect.apply(n.manager.cancelQuery, n.manager, [n.context]);
		} catch (n) {
			t($(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CANCEL_FAILED", "firefox-urlbar-suggestions-finish", "UrlbarProvidersManager.cancelQuery", n));
		}
		s === n && (s = null, o === n.revision && c.phase === "querying" && g("empty"));
	}, w = (t, n, r) => {
		if (!Q(t)) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CONTEXT_INVALID", "firefox-urlbar-suggestions-query", "UrlbarQueryContext");
		v(s);
		let i = Object.freeze({
			context: t,
			input: n.input,
			manager: n.manager,
			revision: r
		});
		s = i;
		let a = S(n, t, r), o;
		try {
			o = Reflect.apply(n.manager.startQuery, n.manager, [t, a]);
		} catch (e) {
			y(i, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "UrlbarProvidersManager.startQuery", e);
			return;
		}
		Promise.resolve(o).then(() => C(i), (e) => y(i, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "UrlbarProvidersManager.startQuery", e));
	}, T = (t, n, r) => {
		let i = new Proxy(t.nativeController, { get(e, t) {
			if (t === "cancelQuery") return () => v(s);
			if (t === "startQuery") return (e) => n(e);
			let r = Reflect.get(e, t, e);
			return Ha(r) ? r.bind(e) : r;
		} }), a, o = !1, c;
		try {
			if (t.input.controller = i, t.input.controller !== i) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_PROXY_REJECTED", "firefox-urlbar-suggestions-proxy", "window.gURLBar.controller");
			c = r();
		} catch (e) {
			a = e, o = !0;
		}
		let l, u = !1;
		try {
			if (t.input.controller = t.nativeController, t.input.controller !== t.nativeController) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_PROXY_RESTORE_FAILED", "firefox-urlbar-suggestions-proxy", "window.gURLBar.controller");
		} catch (e) {
			l = e, u = !0;
		}
		if (u) throw l;
		if (o) throw a;
		return c;
	}, ee = (t) => {
		let n = m();
		v(s), _(), o += 1;
		let r = o;
		g("querying"), n.input.value = t, typeof n.input.selectionStart == "number" && (n.input.selectionStart = t.length), typeof n.input.selectionEnd == "number" && (n.input.selectionEnd = t.length);
		let i = !1;
		try {
			if (T(n, (e) => {
				i = !0, w(e, n, r);
			}, () => Reflect.apply(n.input.startQuery, n.input, [Object.freeze({
				allowAutofill: t.length > 0,
				searchString: t
			})])), !i) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CONTEXT_MISSING", "firefox-urlbar-suggestions-query", "window.gURLBar.startQuery");
			return !0;
		} catch (e) {
			return y(s, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "window.gURLBar.startQuery", e), !1;
		}
	}, E = (n) => {
		let r = s !== null || d.size > 0 || c.phase !== "idle", i = s?.input;
		if (v(s), _(), n && r) try {
			let e = i ?? m().input;
			Reflect.apply(e.handleRevert, e, []);
		} catch (n) {
			t($(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_REVERT_FAILED", "firefox-urlbar-suggestions-cancel", "window.gURLBar.handleRevert", n));
		}
		return (c.phase !== "idle" || c.results.length > 0) && g("idle"), r;
	}, te = (t) => {
		let n = f(), r = {
			altKey: t.altKey,
			bubbles: !0,
			button: t.button,
			cancelable: !0,
			ctrlKey: t.ctrlKey,
			metaKey: t.metaKey,
			shiftKey: t.shiftKey,
			view: n
		};
		if (t.kind === "pointer") {
			let t = n.MouseEvent;
			if (!t) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-execute", "window.MouseEvent");
			return new t("click", r);
		}
		let i = n.KeyboardEvent;
		if (!i) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-execute", "window.KeyboardEvent");
		return new i("keydown", {
			...r,
			code: "Enter",
			key: "Enter"
		});
	}, D = Object.freeze({
		cancel: () => E(!0),
		execute: (e, t) => {
			let n, r;
			try {
				n = La(t), r = u.resolve(e);
			} catch {
				return Object.freeze({ status: "rejected" });
			}
			let i = d.get(e);
			if (!i || i.result !== r || i.queryRevision !== o) return Object.freeze({ status: "rejected" });
			if (i.execution === "native") return Object.freeze({ status: "native-required" });
			let a;
			try {
				a = m();
			} catch (e) {
				return y(s, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED", "firefox-urlbar-suggestions-execute", "window.gURLBar.pickResult", e), Object.freeze({ status: "native-required" });
			}
			if (a.input !== i.input || a.manager !== i.manager) return Object.freeze({ status: "rejected" });
			v(s);
			let c = !1, l = a.input.searchMode;
			try {
				let e = te(n);
				if (T(a, (e) => {
					c = !0, _(), o += 1, g("querying"), w(e, a, o);
				}, () => Reflect.apply(a.input.pickResult, a.input, [
					r,
					e,
					null,
					a.selectedBrowser
				])), !c && a.input.searchMode !== l) {
					let e = typeof a.input.value == "string" ? a.input.value.slice(0, kn) : "";
					_(), o += 1, g("querying"), T(a, (e) => {
						c = !0, w(e, a, o);
					}, () => Reflect.apply(a.input.startQuery, a.input, [Object.freeze({
						allowAutofill: e.length > 0,
						searchString: e
					})]));
				}
			} catch (e) {
				return y(s, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED", "firefox-urlbar-suggestions-execute", "window.gURLBar.pickResult", e), Object.freeze({ status: "native-required" });
			}
			return c ? Object.freeze({ status: "continued" }) : (_(), g("idle"), Object.freeze({ status: "committed" }));
		},
		prepareNativeHandoff: () => E(!1),
		query(t) {
			if (f(), typeof t != "string" || t.length > 4096) throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_INVALID", "firefox-urlbar-suggestions-query", "window.gURLBar.value");
			return ee(t);
		},
		snapshot() {
			return f(), c;
		},
		subscribe(t) {
			if (f(), typeof t != "function") throw $(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_LISTENER_INVALID", "firefox-urlbar-suggestions-subscribe", "urlbarSuggestions.subscribe");
			return l.add(t), b(() => l.delete(t));
		}
	});
	try {
		e.assertRequiredCapabilities(), p(), m();
	} catch (e) {
		throw i = !0, d.clear(), u.dispose(), r = null, e;
	}
	return Object.freeze({
		assertRequiredCapabilities: p,
		dispose() {
			return !i && (l.clear(), E(!0), u.dispose(), i = !0, r = null, !0);
		},
		snapshot() {
			return Object.freeze({
				activeQuery: s !== null,
				disposed: i,
				queryRevision: o,
				resultCount: u.snapshot().activeHandleCount,
				revision: a,
				subscriberCount: l.size
			});
		},
		urlbarSuggestions: D
	});
}
//#endregion
//#region src/app/window-controls-state.ts
var co = Object.freeze([
	"close",
	"minimize",
	"toggle-maximize"
]), lo = new Set(co);
function uo(e) {
	return typeof e == "string" && lo.has(e);
}
//#endregion
//#region src/firefox/window-controls.ts
var fo = (e) => typeof e == "object" && !!e, po = (e) => typeof e == "function", mo = (e, t) => {
	let n = e.document;
	if (!(!fo(n) || !po(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, ho = (e) => Object.freeze(e), go = Object.freeze([
	ho({
		isAvailable: po,
		name: "window-controls.minimize",
		read: (e) => e.minimize,
		symbol: "window.minimize"
	}),
	ho({
		isAvailable: po,
		name: "window-controls.maximize",
		read: (e) => e.maximize,
		symbol: "window.maximize"
	}),
	ho({
		isAvailable: po,
		name: "window-controls.restore",
		read: (e) => e.restore,
		symbol: "window.restore"
	}),
	ho({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.window-state",
		read: (e) => e.windowState,
		symbol: "window.windowState"
	}),
	ho({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.state-maximized",
		read: (e) => e.STATE_MAXIMIZED,
		symbol: "window.STATE_MAXIMIZED"
	}),
	ho({
		isAvailable: po,
		name: "window-controls.sizemode-events",
		read: (e) => e.addEventListener,
		symbol: "window.addEventListener"
	}),
	ho({
		isAvailable: (e) => fo(e) && po(e.doCommand),
		name: "window-controls.close-command",
		read: (e) => mo(e, "cmd_closeWindow"),
		symbol: "document.cmd_closeWindow.doCommand"
	})
]), _o = (e) => Object.freeze(go.map((t) => {
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
})), vo = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, yo = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: vo(e),
	phase: n,
	symbol: r
}), bo = (e) => {
	let t = e.windowState === e.STATE_MAXIMIZED || typeof e.STATE_FULLSCREEN == "number" && e.windowState === e.STATE_FULLSCREEN;
	return Object.freeze({ maximized: t });
};
function xo({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !fo(n) || typeof t != "function") throw yo(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_OPTIONS_INVALID", "firefox-window-controls-create", "window");
	let r = n, i = !1, a = new Set(), o, s = () => {
		if (i || !r) throw yo(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_DISPOSED", "firefox-window-controls-access", "window");
		return r;
	}, c = () => {
		let t = _o(s()), n = t.find((e) => !e.snapshot.available);
		if (n) throw yo(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, l = () => {
		let n;
		try {
			n = bo(s());
		} catch (e) {
			t(e);
			return;
		}
		for (let r of Array.from(a)) try {
			r(n);
		} catch (n) {
			t(yo(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBER_FAILED", "firefox-window-controls-notify", "windowControls.subscribe", n));
		}
	}, u = (t) => {
		if (!uo(t)) throw yo(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_INVALID", "firefox-window-controls-action", "windowControls.action");
		c();
		let n = s();
		try {
			if (t === "minimize") return Reflect.apply(n.minimize, n, []), !0;
			if (t === "toggle-maximize") return bo(n).maximized ? Reflect.apply(n.restore, n, []) : Reflect.apply(n.maximize, n, []), !0;
			let r = mo(n, "cmd_closeWindow");
			if (!fo(r) || !po(r.doCommand)) throw yo(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-action", "document.cmd_closeWindow.doCommand");
			return Reflect.apply(r.doCommand, r, []), !0;
		} catch (n) {
			throw n instanceof g ? n : yo(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_FAILED", "firefox-window-controls-action", t === "close" ? "document.cmd_closeWindow.doCommand" : `window.${t}`, n);
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
		throw yo(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBE_FAILED", "firefox-window-controls-subscribe", "window.addEventListener", t);
	}
	let d = Object.freeze({
		invoke: u,
		snapshot() {
			return bo(s());
		},
		subscribe(t) {
			if (typeof t != "function") throw yo(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_LISTENER_INVALID", "firefox-window-controls-subscribe", "windowControls.subscribe");
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
export { g as FirefoxBridgeError, Pt as addCustomizeLayoutEntry, Ct as copyCustomizeLayout, xt as copyCustomizeLayoutEntry, Tt as createCustomizeLayout, wt as createEmptyCustomizeLayout, P as createFirefoxBookmarksBridge, T as createFirefoxBridgeBoundary, Me as createFirefoxBrowserToolsBridge, Qt as createFirefoxDownloadsBridge, Dn as createFirefoxLocaleBridge, fr as createFirefoxNavigationBridge, Wr as createFirefoxTabsBridge, ra as createFirefoxToolbarWidgetsBridge, ka as createFirefoxUrlbarCoverageBridge, so as createFirefoxUrlbarSuggestionsBridge, xo as createFirefoxWindowControlsBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, ln as createStaticLocaleBridge, _t as customizeLayoutBounds, Bt as customizeLayoutContainsWidget, ht as customizeSpecialKinds, en as defaultFenneviaLocale, At as findCustomizeLayoutEntry, It as getCustomizeLayoutEntry, En as getShellChromeHostLabel, yt as isCustomizeSpecialKind, bt as isCustomizeWidgetId, _ as isFirefoxBridgeError, Lt as moveCustomizeLayoutEntry, Et as parseCustomizeLayout, Ot as parseCustomizeStyle, Ft as removeCustomizeLayoutEntry, Dt as serializeCustomizeLayout, kt as serializeCustomizeStyle, mn as shellChromeHostNames, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic, Rt as withCustomizeAdopted, zt as withoutCustomizeAdopted };
