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
var E = 2048, D = Object.freeze({
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
}), O = Object.freeze(["TabSelect", "TabAttrModified"]), k = new Set([
	"busy",
	"label",
	"selected"
]), A = (e) => `document.commands[${e.replaceAll(":", "-")}]`, j = (e) => typeof e == "object" && !!e, M = (e) => typeof e == "function", N = (e) => j(e) && M(e.addEventListener) && M(e.removeEventListener), P = (e) => e.gBrowser, F = (e, t) => {
	let n = P(e);
	return j(n) ? n[t] : void 0;
}, I = (e, t) => {
	let n = F(e, "selectedBrowser");
	return j(n) ? n[t] : void 0;
}, L = (e, t) => {
	let n = e.BrowserCommands;
	return j(n) ? n[t] : void 0;
}, R = (e, t) => {
	let n = e.document;
	if (!(!j(n) || !M(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, z = (e) => j(e) && M(e.hasAttribute), B = (e) => j(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", V = (e) => j(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), H = Object.freeze([
	Object.freeze({
		isAvailable: B,
		name: "firefox.navigation-selected-browser",
		read: (e) => F(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: V,
		name: "firefox.navigation-current-uri",
		read: (e) => I(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: (e) => j(e) && M(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => F(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: N,
		name: "firefox.navigation-tab-events",
		read: (e) => F(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: M,
		name: `firefox.navigation-${e}`,
		read: (e) => F(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: M,
		name: "firefox.navigation-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	...Object.values(D).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: z,
		name: `firefox.navigation-command-${t}`,
		read: (t) => R(t, e),
		symbol: A(e)
	}), Object.freeze({
		isAvailable: M,
		name: `firefox.navigation-action-${t}`,
		read: (e) => L(e, t),
		symbol: `window.BrowserCommands.${t}`
	})])
]), U = (e) => Object.freeze(H.map((t) => {
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
})), W = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, G = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: W(e),
	phase: n,
	symbol: r
}), K = (e, t) => e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title, q = (e) => {
	if (!j(e) || !j(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => k.has(e));
};
function J({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !j(n) || typeof t != "function") throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID", "firefox-navigation-create", "window");
	let r = n, i = !1, a = null, o = 0, s = Object.freeze({
		canGoBack: !1,
		canGoForward: !1,
		displayUri: "",
		loading: !1,
		title: ""
	}), c = null, l = !1, u = [], d = new Set(), f = () => {
		if (i || !r) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSED", "firefox-navigation-access", "window.gBrowser.selectedBrowser");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, p = () => {
		let t = f().gBrowser;
		if (!j(t)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gBrowser");
		return t;
	}, m = () => {
		let t = p().selectedBrowser;
		if (!B(t)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, h = () => {
		let t = p().selectedTab;
		if (!j(t) || !M(t.getAttribute)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, g = (t) => {
		let n = R(f(), t);
		if (!z(n)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", A(t));
		return n;
	}, v = () => {
		let t = U(f()), n = t.find((e) => !e.snapshot.available);
		if (n) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, y = (e) => {
		let t = g(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, x = (t) => {
		let n = t.currentURI;
		if (!V(n)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, E);
	}, S = () => {
		let e = m(), t = h();
		return Object.freeze({
			canGoBack: y(D.back.id),
			canGoForward: y(D.forward.id),
			displayUri: x(e),
			loading: y(D.stop.id),
			title: String(Reflect.apply(t.getAttribute, t, ["label"]) ?? "").slice(0, 256)
		});
	}, C = () => {
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
	}, w = (e) => {
		let t = S();
		return K(s, t) && o > 0 ? !1 : (s = t, o += 1, e && C(), !0);
	}, T = (n, r) => {
		a = _(n) ? n : G(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, k = (e) => {
		if (!(i || a)) try {
			w(!0);
		} catch (t) {
			T(t, e);
		}
	}, N = (e, t, n) => {
		if (!(i || a)) try {
			e === p().selectedBrowser && j(t) && t.isTopLevel === !0 && w(!0);
		} catch (e) {
			T(e, n);
		}
	}, P = Object.freeze({
		onLocationChange(e, t) {
			N(e, t, "window.gBrowser.onLocationChange");
		},
		onStateChange(e, t) {
			N(e, t, "window.gBrowser.onStateChange");
		}
	}), F = (t, n = !0) => {
		let r = D[t];
		m();
		let i = g(r.id);
		if (n && Reflect.apply(i.hasAttribute, i, ["disabled"])) return !1;
		let a = f().BrowserCommands, o = j(a) ? a[r.method] : void 0;
		if (!M(o)) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${r.method}`);
		try {
			return Reflect.apply(o, a, []), !0;
		} catch (t) {
			throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${r.method}`, t);
		}
	}, I = Object.freeze({
		back: () => F("back"),
		forward: () => F("forward"),
		newTab: () => F("newTab", !1),
		reload: () => F("reload"),
		reloadOrStop() {
			let e = y(D.stop.id) ? "stop" : "reload";
			return F(e), e;
		},
		snapshot() {
			return f(), s;
		},
		stop: () => F("stop"),
		subscribe(t) {
			if (f(), typeof t != "function") throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_LISTENER_INVALID", "firefox-navigation-subscribe", "navigation.subscribe");
			return d.add(t), b(() => {
				d.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), v(), w(!1);
		let t = p().tabContainer;
		for (let n of O) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (j(e) && e.target !== p().selectedTab || !q(e))) return;
				w(!0);
			} catch (e) {
				T(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		let n = p();
		Reflect.apply(n.addTabsProgressListener, n, [P]), l = !0;
		let r = f().MutationObserver;
		c = new r(() => {
			k("document.command.disabled");
		});
		for (let { id: e } of Object.values(D)) c.observe(g(e), {
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
			e && M(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [P]);
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
		assertRequiredCapabilities: v,
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
				Reflect.apply(e.removeTabsProgressListener, e, [P]);
			} catch (e) {
				t ??= e;
			}
			l = !1;
			for (let e of u.reverse()) try {
				e();
			} catch (e) {
				t ??= e;
			}
			if (u.length = 0, d.clear(), r = null, t !== void 0) throw G(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", t);
			return !0;
		},
		navigation: I,
		snapshot() {
			return Object.freeze({
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
]), ee = new Set([
	"busy",
	"image",
	"label",
	"selected"
]), te = 262144, ne = /[\s"'<>\\]/u, re = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, ie = (e) => typeof e == "object" && !!e || typeof e == "function", X = (e) => typeof e == "object" && !!e, ae = (e) => typeof e == "function", oe = (e) => e.gBrowser, Z = (e, t) => {
	let n = oe(e);
	return X(n) ? n[t] : void 0;
}, se = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => Z(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: ie,
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
		isAvailable: ae,
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
]), ce = (e) => Object.freeze(se.map((t) => {
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
})), le = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Q = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: le(e),
	phase: n,
	symbol: r
}), $ = (e, t) => {
	if (!X(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw Q(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, ue = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !ne.test(e) || e.length <= te && re.test(e))) return e;
}, de = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl;
}), fe = (e) => {
	if (!X(e) || !X(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => ee.has(e));
};
function pe({ boundary: e, onError: t, window: n }) {
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
		let t = ce(f()), n = t.find((e) => !e.snapshot.available);
		if (n) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, h = () => {
		let t = p().openTabs;
		if (!Array.isArray(t)) throw Q(e, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = t.map((t) => $(e, t));
		if (new Set(n).size !== n.length) throw Q(e, "FENNEVIA_FIREFOX_TAB_ORDER_INVALID", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		return n;
	}, g = (e, t) => Reflect.apply(e.getAttribute, e, [t]), v = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), y = (e, t) => {
		let n = String(g(e, "label") ?? "").slice(0, 256), r = ue(g(e, "image"));
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
		return !de(s, i) && (s = i, o += 1, e && x(), !0);
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
				if (n === "TabAttrModified" && !fe(e)) return;
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
export { g as FirefoxBridgeError, T as createFirefoxBridgeBoundary, J as createFirefoxNavigationBridge, pe as createFirefoxTabsBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, _ as isFirefoxBridgeError, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic };
