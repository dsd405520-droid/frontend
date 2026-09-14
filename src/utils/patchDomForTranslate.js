/**
 * Google Translate (and some other browser extensions) rewrite text nodes
 * in the live DOM outside of React's control — wrapping them in <font> tags,
 * moving them, etc. React still thinks the DOM looks the way it last left it,
 * so when it later tries to remove/insert a node that Translate already
 * relocated, the native DOM call throws NotFoundError and crashes the app
 * ("Failed to execute 'removeChild' on 'Node'...").
 *
 * This patch makes Node.removeChild / Node.insertBefore defensive: if the
 * node React is trying to remove/reference is no longer actually where React
 * thinks it is, we no-op instead of throwing. This does NOT disable Google
 * Translate or change any behavior for users — it just stops a harmless
 * DOM-ownership race from taking down the whole page.
 *
 * Import this once, as early as possible (top of main.jsx), before anything
 * renders.
 */
export function patchDomForTranslate() {
    if (typeof Node === 'undefined' || !Node.prototype) return;
    // Avoid patching twice (e.g. React StrictMode double-invoke / HMR)
    if (Node.prototype.__translateSafePatchApplied) return;
    Node.prototype.__translateSafePatchApplied = true;

    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function(child) {
        if (child.parentNode !== this) {
            if (console && console.warn) {
                console.warn(
                    '[translate-safe] Skipped removeChild: node was already moved out ' +
                    'from under React (likely by a browser translation extension).',
                    child
                );
            }
            return child;
        }
        return originalRemoveChild.call(this, child);
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(newNode, referenceNode) {
        if (referenceNode && referenceNode.parentNode !== this) {
            if (console && console.warn) {
                console.warn(
                    '[translate-safe] Skipped insertBefore: reference node was already ' +
                    'moved out from under React (likely by a browser translation extension).',
                    referenceNode
                );
            }
            return newNode;
        }
        return originalInsertBefore.call(this, newNode, referenceNode);
    };
}