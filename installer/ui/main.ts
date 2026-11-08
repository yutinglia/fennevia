// SPDX-License-Identifier: MPL-2.0
import { mount } from "svelte";
import App from "./App.svelte";
import "./style.css";
const target = document.getElementById("app");
if (!target) throw new Error("SETUP_HOST_MISSING");
mount(App, { target });
