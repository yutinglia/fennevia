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
//#region src/app/navigation-state.ts
var E = 2048, D = 4096, O = Object.freeze({
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
}), ee = Object.freeze(["TabSelect", "TabAttrModified"]), te = new Set([
	"busy",
	"label",
	"selected"
]), k = "Browser:OpenLocation", ne = "focusURLBar", re = "data-fennevia-healthy", ie = Object.freeze({
	selectAll: !0,
	source: "ctrl-l",
	type: "address-popup-open"
}), ae = Object.freeze({ status: "accepted" }), oe = Object.freeze({
	reason: "empty",
	status: "rejected"
}), se = Object.freeze({
	reason: "too-long",
	status: "rejected"
}), ce = Object.freeze({
	reason: "unsafe-scheme",
	status: "rejected"
}), le = /^\s*(?:data|javascript|vbscript)\s*:/iu, ue = new Set([
	"about:blank",
	"about:home",
	"about:newtab",
	"about:privatebrowsing"
]), de = Object.freeze({
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
}), A = (e) => `document.commands[${e.replaceAll(":", "-")}]`, j = (e) => typeof e == "object" && !!e, M = (e) => typeof e == "function", N = (e) => j(e) && M(e.addEventListener) && M(e.removeEventListener), fe = (e) => e.gBrowser, P = (e, t) => {
	let n = fe(e);
	return j(n) ? n[t] : void 0;
}, F = (e, t) => {
	let n = P(e, "selectedBrowser");
	return j(n) ? n[t] : void 0;
}, I = (e, t) => {
	let n = e.BrowserCommands;
	return j(n) ? n[t] : void 0;
}, L = (e, t) => {
	let n = e.gURLBar;
	return j(n) ? n[t] : void 0;
}, R = (e, t) => e[t], z = (e) => {
	let t = e.document;
	return j(t) ? t.documentElement : void 0;
}, B = (e, t) => {
	let n = e.document;
	if (!(!j(n) || !M(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, V = (e) => j(e) && M(e.hasAttribute), pe = (e) => N(e) && typeof e.value == "string" && M(e.getAttribute) && M(e.handleCommand), H = (e) => j(e) && M(e.getConnectionSecurityInformation), U = (e) => j(e) && M(e.onContentBlockingEvent), W = (e) => j(e) && M(e.canHandle), G = (e) => j(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", me = (e) => j(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), he = Object.freeze([
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-selected-browser",
		read: (e) => P(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: me,
		name: "firefox.navigation-current-uri",
		read: (e) => F(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: M,
		name: "firefox.navigation-selected-browser-focus",
		read: (e) => F(e, "focus"),
		symbol: "window.gBrowser.selectedBrowser.focus"
	}),
	Object.freeze({
		isAvailable: (e) => j(e) && M(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => P(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: N,
		name: "firefox.navigation-tab-events",
		read: (e) => P(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: M,
		name: `firefox.navigation-${e}`,
		read: (e) => P(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: M,
		name: "firefox.navigation-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: (e) => typeof e == "string",
		name: "firefox.navigation-urlbar-value",
		read: (e) => L(e, "value"),
		symbol: "window.gURLBar.value"
	}),
	Object.freeze({
		isAvailable: M,
		name: "firefox.navigation-urlbar-submission",
		read: (e) => L(e, "handleCommand"),
		symbol: "window.gURLBar.handleCommand"
	}),
	Object.freeze({
		isAvailable: M,
		name: "firefox.navigation-urlbar-proxy-state",
		read: (e) => L(e, "getAttribute"),
		symbol: "window.gURLBar.getAttribute"
	}),
	Object.freeze({
		isAvailable: H,
		name: "firefox.navigation-connection-security",
		read: (e) => R(e, "gIdentityHandler"),
		symbol: "window.gIdentityHandler.getConnectionSecurityInformation"
	}),
	Object.freeze({
		isAvailable: U,
		name: "firefox.navigation-tracking-protection",
		read: (e) => R(e, "gProtectionsHandler"),
		symbol: "window.gProtectionsHandler.onContentBlockingEvent"
	}),
	Object.freeze({
		isAvailable: W,
		name: "firefox.navigation-tracking-protection-availability",
		read: (e) => R(e, "ContentBlockingAllowList"),
		symbol: "window.ContentBlockingAllowList.canHandle"
	}),
	Object.freeze({
		isAvailable: (e) => V(e) && N(e),
		name: "firefox.navigation-open-location-command",
		read: (e) => B(e, k),
		symbol: A(k)
	}),
	Object.freeze({
		isAvailable: (e) => j(e) && M(e.hasAttribute),
		name: "firefox.navigation-shell-health-gate",
		read: z,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Object.values(O).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: V,
		name: `firefox.navigation-command-${t}`,
		read: (t) => B(t, e),
		symbol: A(e)
	}), Object.freeze({
		isAvailable: M,
		name: `firefox.navigation-action-${t}`,
		read: (e) => I(e, t),
		symbol: `window.BrowserCommands.${t}`
	})])
]), ge = (e) => Object.freeze(he.map((t) => {
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
})), K = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, q = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: K(e),
	phase: n,
	symbol: r
}), _e = (e, t) => e.addressValue === t.addressValue && e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.connectionSecurity === t.connectionSecurity && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title && e.trackingProtection === t.trackingProtection, ve = (e) => {
	if (!j(e) || !j(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => te.has(e));
};
function J({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !j(n) || typeof t != "function") throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID", "firefox-navigation-create", "window");
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
		if (!j(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gBrowser");
		return t;
	}, h = () => {
		let t = m().selectedBrowser;
		if (!G(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, g = () => {
		let t = m().selectedTab;
		if (!j(t) || !M(t.getAttribute)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, v = (t) => {
		let n = B(p(), t);
		if (!V(n)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", A(t));
		return n;
	}, y = () => {
		let t = p().gURLBar;
		if (!pe(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gURLBar.handleCommand");
		return t;
	}, x = () => {
		let t = p().gIdentityHandler;
		if (!H(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gIdentityHandler.getConnectionSecurityInformation");
		return t;
	}, S = () => {
		let t = p().gProtectionsHandler;
		if (!U(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gProtectionsHandler.onContentBlockingEvent");
		return t;
	}, C = () => {
		let t = p().ContentBlockingAllowList;
		if (!W(t)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.ContentBlockingAllowList.canHandle");
		return t;
	}, w = () => {
		let t = ge(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (e) => {
		let t = v(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, te = (t) => {
		let n = t.currentURI;
		if (!me(n)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, E);
	}, N = (e) => {
		if (ue.has(e)) return "";
		let t = y();
		return (Reflect.apply(t.getAttribute, t, ["pageproxystate"]) === "valid" ? t.value : e).slice(0, D);
	}, fe = () => {
		let e = x(), t = Reflect.apply(e.getConnectionSecurityInformation, e, []);
		return typeof t == "string" ? de[t] ?? "unavailable" : "unavailable";
	}, P = (e) => {
		let t = C();
		if (Reflect.apply(t.canHandle, t, [e]) !== !0) return "unavailable";
		let n = S();
		return typeof n.hasException != "boolean" || typeof n.anyBlocking != "boolean" || typeof n.anyDetected != "boolean" ? "unavailable" : n.hasException ? "exception" : n.anyBlocking ? "blocking" : n.anyDetected ? "detected" : "no-trackers-detected";
	}, F = () => {
		let e = h(), t = g(), n = te(e);
		return Object.freeze({
			addressValue: N(n),
			canGoBack: T(O.back.id),
			canGoForward: T(O.forward.id),
			connectionSecurity: fe(),
			displayUri: n,
			loading: T(O.stop.id),
			title: String(Reflect.apply(t.getAttribute, t, ["label"]) ?? "").slice(0, 256),
			trackingProtection: P(e)
		});
	}, I = () => {
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
	}, L = (e) => {
		let t = F();
		return _e(s, t) && o > 0 ? !1 : (s = t, o += 1, e && I(), !0);
	}, R = (n, r) => {
		a = _(n) ? n : q(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, he = (e) => {
		if (!(i || a)) try {
			L(!0);
		} catch (t) {
			R(t, e);
		}
	}, K = (e, t, n) => {
		if (!(i || a)) try {
			e === m().selectedBrowser && j(t) && t.isTopLevel === !0 && L(!0);
		} catch (e) {
			R(e, n);
		}
	}, J = Object.freeze({
		onLocationChange(e, t) {
			K(e, t, "window.gBrowser.onLocationChange");
		},
		onStateChange(e, t) {
			K(e, t, "window.gBrowser.onStateChange");
		},
		onSecurityChange(e, t) {
			K(e, t, "window.gBrowser.onSecurityChange");
		},
		onContentBlockingEvent(e, t) {
			K(e, t, "window.gBrowser.onContentBlockingEvent");
		}
	}), Y = (t, n = !0) => {
		let r = O[t];
		h();
		let i = v(r.id);
		if (n && Reflect.apply(i.hasAttribute, i, ["disabled"])) return !1;
		let a = p().BrowserCommands, o = j(a) ? a[r.method] : void 0;
		if (!M(o)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${r.method}`);
		try {
			return Reflect.apply(o, a, []), !0;
		} catch (t) {
			throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${r.method}`, t);
		}
	}, ye = (t) => {
		if (typeof t != "string") return oe;
		if (t.length > 4096) return se;
		if (t.trim().length === 0) return oe;
		if (le.test(t)) return ce;
		h();
		let n = y();
		try {
			return n.value = t, Reflect.apply(n.handleCommand, n, []), ae;
		} catch (t) {
			throw q(e, "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED", "firefox-address-submit", "window.gURLBar.handleCommand", t);
		}
	}, be = () => {
		let e = z(p());
		return j(e) && M(e.hasAttribute) && !!Reflect.apply(e.hasAttribute, e, [re]);
	}, xe = (e) => {
		if (!j(e) || !j(e.sourceEvent)) return !1;
		let t = e.sourceEvent.target;
		return j(t) && t.id === ne;
	}, Se = (e) => {
		if (!(i || a)) try {
			if (!be() || !xe(e) || f.size === 0) return;
			L(!0);
			let t = !1;
			for (let e of Array.from(f)) t = e(ie) === !0 || t;
			if (!t || !j(e)) return;
			M(e.preventDefault) && Reflect.apply(e.preventDefault, e, []), M(e.stopPropagation) && Reflect.apply(e.stopPropagation, e, []);
		} catch (e) {
			R(e, A(k));
		}
	}, Ce = Object.freeze({
		back: () => Y("back"),
		focusContent() {
			let t = h(), n = t.focus;
			if (!M(n)) throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus");
			try {
				return Reflect.apply(n, t, []), !0;
			} catch (t) {
				throw q(e, "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus", t);
			}
		},
		forward: () => Y("forward"),
		newTab: () => Y("newTab", !1),
		reload: () => Y("reload"),
		reloadOrStop() {
			let e = T(O.stop.id) ? "stop" : "reload";
			return Y(e), e;
		},
		snapshot() {
			return p(), s;
		},
		stop: () => Y("stop"),
		submitAddress: ye,
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
		e.assertRequiredCapabilities(), w(), L(!1);
		let t = m().tabContainer;
		for (let n of ee) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (j(e) && e.target !== m().selectedTab || !ve(e))) return;
				L(!0);
			} catch (e) {
				R(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		u.push(e.subscribe(v(k), "command", Se));
		let n = m();
		Reflect.apply(n.addTabsProgressListener, n, [J]), l = !0;
		let r = p().MutationObserver;
		c = new r(() => {
			he("document.command.disabled");
		});
		for (let { id: e } of Object.values(O)) c.observe(v(e), {
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
			let e = j(r.gBrowser) ? r.gBrowser : null;
			e && M(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [J]);
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
				let e = j(r.gBrowser) ? r.gBrowser : null;
				if (!e || !M(e.removeTabsProgressListener)) throw TypeError("FENNEVIA_FIREFOX_NAVIGATION_PROGRESS_DISPOSER_INVALID");
				Reflect.apply(e.removeTabsProgressListener, e, [J]);
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
		navigation: Ce,
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
var Y = Object.freeze([
	"TabOpen",
	"TabClose",
	"TabSelect",
	"TabMove",
	"TabPinned",
	"TabUnpinned",
	"TabAttrModified"
]), ye = new Set([
	"busy",
	"image",
	"label",
	"selected"
]), be = 262144, xe = /[\s"'<>\\]/u, Se = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, Ce = (e) => typeof e == "object" && !!e || typeof e == "function", X = (e) => typeof e == "object" && !!e, we = (e) => typeof e == "function", Te = (e) => e.gBrowser, Z = (e, t) => {
	let n = Te(e);
	return X(n) ? n[t] : void 0;
}, Ee = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => Z(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: Ce,
		name: "firefox.selected-tab",
		read: (e) => Z(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab"
	}),
	...[
		["add-tab", "addTrustedTab"],
		["remove-tab", "removeTab"],
		["pin-tab", "pinTab"],
		["unpin-tab", "unpinTab"]
	].map(([e, t]) => Object.freeze({
		isAvailable: we,
		name: `firefox.${e}`,
		read: (e) => Z(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: (e) => typeof e == "string" && e.length > 0 && e.length <= 2048,
		name: "firefox.new-tab-url",
		read: (e) => e.BROWSER_NEW_TAB_URL,
		symbol: "window.BROWSER_NEW_TAB_URL"
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
}, Q = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Oe(e),
	phase: n,
	symbol: r
}), $ = (e, t) => {
	if (!X(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw Q(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, ke = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !xe.test(e) || e.length <= be && Se.test(e))) return e;
}, Ae = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl;
}), je = (e) => {
	if (!X(e) || !X(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => ye.has(e));
};
function Me({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !X(n) || typeof t != "function") throw Q(e, "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID", "firefox-tabs-create", "window");
	let r = n, i = !1, a = null, o = 0, s = Object.freeze([]), c = new Set(), l = new Set(), u = [], d = e.createHandleRegistry("tab"), f = () => {
		if (i || !r) throw Q(e, "FENNEVIA_FIREFOX_TABS_DISPOSED", "firefox-tabs-access", "window.gBrowser.openTabs");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, p = () => {
		let t = f().gBrowser;
		if (!X(t)) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "window.gBrowser");
		return t;
	}, m = () => {
		let t = De(f()), n = t.find((e) => !e.snapshot.available);
		if (n) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, h = () => {
		let t = p().openTabs;
		if (!Array.isArray(t)) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = t.map((t) => $(e, t));
		if (new Set(n).size !== n.length) throw Q(e, "FENNEVIA_FIREFOX_TAB_ORDER_INVALID", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		return n;
	}, g = (e, t) => Reflect.apply(e.getAttribute, e, [t]), v = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), y = (e, t) => {
		let n = String(g(e, "label") ?? "").slice(0, 256), r = ke(g(e, "image"));
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
			t(Q(e, "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED", "firefox-tabs-notify", "tabs.subscribe", n));
		}
	}, S = (e) => {
		let t = p(), n = h().map((e) => y(e, t.selectedTab)), r = new Set(n.map((e) => e.id));
		for (let e of Array.from(c)) r.has(e) || (d.release(e), c.delete(e));
		for (let e of r) c.add(e);
		let i = Object.freeze(n);
		return !Ae(s, i) && (s = i, o += 1, e && x(), !0);
	}, C = (n, r) => {
		a = _(n) ? n : Q(e, "FENNEVIA_FIREFOX_TABS_EVENT_FAILED", "firefox-tabs-event", `window.gBrowser.tabContainer.${r}`, n), t(a);
	}, w = (t) => {
		f();
		let n = d.resolve(t);
		if (!h().includes(n)) throw d.release(t), c.delete(t), Q(e, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-action", "tab.opaque-id");
		return n;
	}, T = (t, n) => {
		let r = p(), i = r[t];
		if (typeof i != "function") throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", `window.gBrowser.${t}`);
		return Reflect.apply(i, r, n);
	}, E = (t) => {
		if (t === void 0) return Object.freeze({ selected: !0 });
		if (!X(t) || Object.keys(t).some((e) => e !== "selected") || t.selected !== void 0 && typeof t.selected != "boolean") throw Q(e, "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID", "firefox-tabs-action", "tabs.open.options");
		return Object.freeze({ selected: t.selected ?? !0 });
	}, D = Object.freeze({
		close(e) {
			let t = w(e);
			T("removeTab", [t, {
				animate: !0,
				isUserTriggered: !0
			}]), S(!0);
		},
		open(t) {
			let n = E(t), r = f().BROWSER_NEW_TAB_URL;
			if (typeof r != "string" || r.length === 0) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.BROWSER_NEW_TAB_URL");
			let i = $(e, T("addTrustedTab", [r, { inBackground: !n.selected }]));
			if (!h().includes(i)) throw Q(e, "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED", "firefox-tabs-action", "window.gBrowser.addTrustedTab");
			let a = d.register(i);
			if (S(!0), n.selected && p().selectedTab !== i) throw Q(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			return a;
		},
		pin(t) {
			let n = w(t);
			if (!v(n, "pinned")) {
				if (T("pinTab", [n]), !v(n, "pinned")) throw Q(e, "FENNEVIA_FIREFOX_TAB_PIN_REJECTED", "firefox-tabs-action", "window.gBrowser.pinTab");
				S(!0);
			}
		},
		select(t) {
			let n = w(t), r = p();
			if (r.selectedTab !== n) {
				if (!Reflect.set(r, "selectedTab", n) || r.selectedTab !== n) throw Q(e, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
				S(!0);
			}
		},
		snapshot() {
			return f(), s;
		},
		subscribe(t) {
			if (f(), typeof t != "function") throw Q(e, "FENNEVIA_FIREFOX_TABS_LISTENER_INVALID", "firefox-tabs-subscribe", "tabs.subscribe");
			return l.add(t), b(() => {
				l.delete(t);
			});
		},
		unpin(t) {
			let n = w(t);
			if (v(n, "pinned")) {
				if (T("unpinTab", [n]), v(n, "pinned")) throw Q(e, "FENNEVIA_FIREFOX_TAB_UNPIN_REJECTED", "firefox-tabs-action", "window.gBrowser.unpinTab");
				S(!0);
			}
		}
	});
	try {
		e.assertRequiredCapabilities(), m(), S(!1);
		let t = p().tabContainer;
		for (let n of Y) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && !je(e)) return;
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
		throw a !== void 0 && t(Q(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", a)), n;
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
			if (t !== void 0) throw Q(e, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", t);
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
		tabs: D
	});
}
//#endregion
export { g as FirefoxBridgeError, T as createFirefoxBridgeBoundary, J as createFirefoxNavigationBridge, Me as createFirefoxTabsBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, _ as isFirefoxBridgeError, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic };
