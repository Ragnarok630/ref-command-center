/* =========================================================
   KINGDOM 630 – REBELS OF FURY
   Command Center Build Configuration

   File: assets/js/config/build.js
   Release: 630.1.0 Gold Master

   Centrale bron voor applicatie- en releasegegevens.
========================================================= */

(function initializeK630Build(global) {
  "use strict";

  if (!global || global.K630_BUILD) {
    return;
  }

  const BUILD = {
    project: "Kingdom 630 – Rebels of Fury",
    application: "Command Center",

    version: "630.1.0",
    releaseName: "Gold Master",
    channel: "stable",

    kingdom: 630,
    schemaVersion: 1,

    get displayVersion() {
      return `Version ${this.version}`;
    },

    get fullVersion() {
      return `${this.version} ${this.releaseName}`;
    },

    get displayName() {
      return `${this.project} – ${this.application}`;
    }
  };

  function updateVersionElements(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    const versionElements = root.querySelectorAll(
      "#topbarVersion, [data-k630-version]"
    );

    versionElements.forEach((element) => {
      element.textContent = BUILD.displayVersion;
      element.dataset.k630Version = BUILD.version;
      element.dataset.k630Release = BUILD.releaseName;
    });
  }

  function updateBuildElements(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    updateVersionElements(root);

    root
      .querySelectorAll("[data-k630-full-version]")
      .forEach((element) => {
        element.textContent = BUILD.fullVersion;
      });

    root
      .querySelectorAll("[data-k630-project-name]")
      .forEach((element) => {
        element.textContent = BUILD.project;
      });

    root
      .querySelectorAll("[data-k630-application-name]")
      .forEach((element) => {
        element.textContent = BUILD.application;
      });
  }

  Object.defineProperties(BUILD, {
    displayVersion: {
      enumerable: true
    },
    fullVersion: {
      enumerable: true
    },
    displayName: {
      enumerable: true
    }
  });

  Object.freeze(BUILD);

  global.K630_BUILD = BUILD;
  global.K630Build = Object.freeze({
    update: updateBuildElements,
    updateVersion: updateVersionElements
  });

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => updateBuildElements(document),
      { once: true }
    );
  } else {
    updateBuildElements(document);
  }

  document.addEventListener("k630:page-loaded", (event) => {
    const root =
      event.detail?.container instanceof Element
        ? event.detail.container
        : document;

    updateBuildElements(root);
  });

  console.info(
    `[K630 Build] ${BUILD.displayName} ${BUILD.fullVersion}`
  );
})(window);