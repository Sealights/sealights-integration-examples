/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler/src/schema/dom_security_schema", ["require", "exports", "tslib", "@angular/compiler/src/core"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.isIframeSecuritySensitiveAttr = exports.IFRAME_SECURITY_SENSITIVE_ATTRS = exports.SECURITY_SCHEMA = void 0;
    var tslib_1 = require("tslib");
    var core_1 = require("@angular/compiler/src/core");
    // =================================================================================================
    // =================================================================================================
    // =========== S T O P   -  S T O P   -  S T O P   -  S T O P   -  S T O P   -  S T O P  ===========
    // =================================================================================================
    // =================================================================================================
    //
    //        DO NOT EDIT THIS LIST OF SECURITY SENSITIVE PROPERTIES WITHOUT A SECURITY REVIEW!
    //                               Reach out to mprobst for details.
    //
    // =================================================================================================
    /** Map from tagName|propertyName to SecurityContext. Properties applying to all tags use '*'. */
    var _SECURITY_SCHEMA;
    function SECURITY_SCHEMA() {
        if (!_SECURITY_SCHEMA) {
            _SECURITY_SCHEMA = {};
            // Case is insignificant below, all element and attribute names are lower-cased for lookup.
            registerContext(core_1.SecurityContext.HTML, [
                'iframe|srcdoc',
                '*|innerHTML',
                '*|outerHTML',
            ]);
            registerContext(core_1.SecurityContext.STYLE, ['*|style']);
            // NB: no SCRIPT contexts here, they are never allowed due to the parser stripping them.
            registerContext(core_1.SecurityContext.URL, [
                '*|formAction', 'area|href', 'area|ping', 'audio|src', 'a|href',
                'a|ping', 'blockquote|cite', 'body|background', 'del|cite', 'form|action',
                'img|src', 'img|srcset', 'input|src', 'ins|cite', 'q|cite',
                'source|src', 'source|srcset', 'track|src', 'video|poster', 'video|src',
            ]);
            registerContext(core_1.SecurityContext.RESOURCE_URL, [
                'applet|code',
                'applet|codebase',
                'base|href',
                'embed|src',
                'frame|src',
                'head|profile',
                'html|manifest',
                'iframe|src',
                'link|href',
                'media|src',
                'object|codebase',
                'object|data',
                'script|src',
            ]);
        }
        return _SECURITY_SCHEMA;
    }
    exports.SECURITY_SCHEMA = SECURITY_SCHEMA;
    function registerContext(ctx, specs) {
        var e_1, _a;
        try {
            for (var specs_1 = tslib_1.__values(specs), specs_1_1 = specs_1.next(); !specs_1_1.done; specs_1_1 = specs_1.next()) {
                var spec = specs_1_1.value;
                _SECURITY_SCHEMA[spec.toLowerCase()] = ctx;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (specs_1_1 && !specs_1_1.done && (_a = specs_1.return)) _a.call(specs_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    /**
     * The set of security-sensitive attributes of an `<iframe>` that *must* be
     * applied as a static attribute only. This ensures that all security-sensitive
     * attributes are taken into account while creating an instance of an `<iframe>`
     * at runtime.
     *
     * Note: avoid using this set directly, use the `isIframeSecuritySensitiveAttr` function
     * in the code instead.
     */
    exports.IFRAME_SECURITY_SENSITIVE_ATTRS = new Set(['sandbox', 'allow', 'allowfullscreen', 'referrerpolicy', 'csp', 'fetchpriority']);
    /**
     * Checks whether a given attribute name might represent a security-sensitive
     * attribute of an <iframe>.
     */
    function isIframeSecuritySensitiveAttr(attrName) {
        // The `setAttribute` DOM API is case-insensitive, so we lowercase the value
        // before checking it against a known security-sensitive attributes.
        return exports.IFRAME_SECURITY_SENSITIVE_ATTRS.has(attrName.toLowerCase());
    }
    exports.isIframeSecuritySensitiveAttr = isIframeSecuritySensitiveAttr;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX3NlY3VyaXR5X3NjaGVtYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyL3NyYy9zY2hlbWEvZG9tX3NlY3VyaXR5X3NjaGVtYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsbURBQXdDO0lBRXhDLG9HQUFvRztJQUNwRyxvR0FBb0c7SUFDcEcsb0dBQW9HO0lBQ3BHLG9HQUFvRztJQUNwRyxvR0FBb0c7SUFDcEcsRUFBRTtJQUNGLDJGQUEyRjtJQUMzRixrRUFBa0U7SUFDbEUsRUFBRTtJQUNGLG9HQUFvRztJQUVwRyxpR0FBaUc7SUFDakcsSUFBSSxnQkFBaUQsQ0FBQztJQUV0RCxTQUFnQixlQUFlO1FBQzdCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUNyQixnQkFBZ0IsR0FBRyxFQUFFLENBQUM7WUFDdEIsMkZBQTJGO1lBRTNGLGVBQWUsQ0FBQyxzQkFBZSxDQUFDLElBQUksRUFBRTtnQkFDcEMsZUFBZTtnQkFDZixhQUFhO2dCQUNiLGFBQWE7YUFDZCxDQUFDLENBQUM7WUFDSCxlQUFlLENBQUMsc0JBQWUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3BELHdGQUF3RjtZQUN4RixlQUFlLENBQUMsc0JBQWUsQ0FBQyxHQUFHLEVBQUU7Z0JBQ25DLGNBQWMsRUFBRSxXQUFXLEVBQVEsV0FBVyxFQUFRLFdBQVcsRUFBSyxRQUFRO2dCQUM5RSxRQUFRLEVBQVEsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsVUFBVSxFQUFNLGFBQWE7Z0JBQ25GLFNBQVMsRUFBTyxZQUFZLEVBQU8sV0FBVyxFQUFRLFVBQVUsRUFBTSxRQUFRO2dCQUM5RSxZQUFZLEVBQUksZUFBZSxFQUFJLFdBQVcsRUFBUSxjQUFjLEVBQUUsV0FBVzthQUNsRixDQUFDLENBQUM7WUFDSCxlQUFlLENBQUMsc0JBQWUsQ0FBQyxZQUFZLEVBQUU7Z0JBQzVDLGFBQWE7Z0JBQ2IsaUJBQWlCO2dCQUNqQixXQUFXO2dCQUNYLFdBQVc7Z0JBQ1gsV0FBVztnQkFDWCxjQUFjO2dCQUNkLGVBQWU7Z0JBQ2YsWUFBWTtnQkFDWixXQUFXO2dCQUNYLFdBQVc7Z0JBQ1gsaUJBQWlCO2dCQUNqQixhQUFhO2dCQUNiLFlBQVk7YUFDYixDQUFDLENBQUM7U0FDSjtRQUNELE9BQU8sZ0JBQWdCLENBQUM7SUFDMUIsQ0FBQztJQW5DRCwwQ0FtQ0M7SUFFRCxTQUFTLGVBQWUsQ0FBQyxHQUFvQixFQUFFLEtBQWU7OztZQUM1RCxLQUFtQixJQUFBLFVBQUEsaUJBQUEsS0FBSyxDQUFBLDRCQUFBO2dCQUFuQixJQUFNLElBQUksa0JBQUE7Z0JBQVcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDO2FBQUE7Ozs7Ozs7OztJQUN2RSxDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDVSxRQUFBLCtCQUErQixHQUN4QyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7SUFFL0Y7OztPQUdHO0lBQ0gsU0FBZ0IsNkJBQTZCLENBQUMsUUFBZ0I7UUFDNUQsNEVBQTRFO1FBQzVFLG9FQUFvRTtRQUNwRSxPQUFPLHVDQUErQixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBSkQsc0VBSUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtTZWN1cml0eUNvbnRleHR9IGZyb20gJy4uL2NvcmUnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA9PT09PT09PT09PSBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgICAtICBTIFQgTyBQICAgLSAgUyBUIE8gUCAgIC0gIFMgVCBPIFAgID09PT09PT09PT09XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vL1xuLy8gICAgICAgIERPIE5PVCBFRElUIFRISVMgTElTVCBPRiBTRUNVUklUWSBTRU5TSVRJVkUgUFJPUEVSVElFUyBXSVRIT1VUIEEgU0VDVVJJVFkgUkVWSUVXIVxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUmVhY2ggb3V0IHRvIG1wcm9ic3QgZm9yIGRldGFpbHMuXG4vL1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKiogTWFwIGZyb20gdGFnTmFtZXxwcm9wZXJ0eU5hbWUgdG8gU2VjdXJpdHlDb250ZXh0LiBQcm9wZXJ0aWVzIGFwcGx5aW5nIHRvIGFsbCB0YWdzIHVzZSAnKicuICovXG5sZXQgX1NFQ1VSSVRZX1NDSEVNQSE6IHtbazogc3RyaW5nXTogU2VjdXJpdHlDb250ZXh0fTtcblxuZXhwb3J0IGZ1bmN0aW9uIFNFQ1VSSVRZX1NDSEVNQSgpOiB7W2s6IHN0cmluZ106IFNlY3VyaXR5Q29udGV4dH0ge1xuICBpZiAoIV9TRUNVUklUWV9TQ0hFTUEpIHtcbiAgICBfU0VDVVJJVFlfU0NIRU1BID0ge307XG4gICAgLy8gQ2FzZSBpcyBpbnNpZ25pZmljYW50IGJlbG93LCBhbGwgZWxlbWVudCBhbmQgYXR0cmlidXRlIG5hbWVzIGFyZSBsb3dlci1jYXNlZCBmb3IgbG9va3VwLlxuXG4gICAgcmVnaXN0ZXJDb250ZXh0KFNlY3VyaXR5Q29udGV4dC5IVE1MLCBbXG4gICAgICAnaWZyYW1lfHNyY2RvYycsXG4gICAgICAnKnxpbm5lckhUTUwnLFxuICAgICAgJyp8b3V0ZXJIVE1MJyxcbiAgICBdKTtcbiAgICByZWdpc3RlckNvbnRleHQoU2VjdXJpdHlDb250ZXh0LlNUWUxFLCBbJyp8c3R5bGUnXSk7XG4gICAgLy8gTkI6IG5vIFNDUklQVCBjb250ZXh0cyBoZXJlLCB0aGV5IGFyZSBuZXZlciBhbGxvd2VkIGR1ZSB0byB0aGUgcGFyc2VyIHN0cmlwcGluZyB0aGVtLlxuICAgIHJlZ2lzdGVyQ29udGV4dChTZWN1cml0eUNvbnRleHQuVVJMLCBbXG4gICAgICAnKnxmb3JtQWN0aW9uJywgJ2FyZWF8aHJlZicsICAgICAgICdhcmVhfHBpbmcnLCAgICAgICAnYXVkaW98c3JjJywgICAgJ2F8aHJlZicsXG4gICAgICAnYXxwaW5nJywgICAgICAgJ2Jsb2NrcXVvdGV8Y2l0ZScsICdib2R5fGJhY2tncm91bmQnLCAnZGVsfGNpdGUnLCAgICAgJ2Zvcm18YWN0aW9uJyxcbiAgICAgICdpbWd8c3JjJywgICAgICAnaW1nfHNyY3NldCcsICAgICAgJ2lucHV0fHNyYycsICAgICAgICdpbnN8Y2l0ZScsICAgICAncXxjaXRlJyxcbiAgICAgICdzb3VyY2V8c3JjJywgICAnc291cmNlfHNyY3NldCcsICAgJ3RyYWNrfHNyYycsICAgICAgICd2aWRlb3xwb3N0ZXInLCAndmlkZW98c3JjJyxcbiAgICBdKTtcbiAgICByZWdpc3RlckNvbnRleHQoU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCwgW1xuICAgICAgJ2FwcGxldHxjb2RlJyxcbiAgICAgICdhcHBsZXR8Y29kZWJhc2UnLFxuICAgICAgJ2Jhc2V8aHJlZicsXG4gICAgICAnZW1iZWR8c3JjJyxcbiAgICAgICdmcmFtZXxzcmMnLFxuICAgICAgJ2hlYWR8cHJvZmlsZScsXG4gICAgICAnaHRtbHxtYW5pZmVzdCcsXG4gICAgICAnaWZyYW1lfHNyYycsXG4gICAgICAnbGlua3xocmVmJyxcbiAgICAgICdtZWRpYXxzcmMnLFxuICAgICAgJ29iamVjdHxjb2RlYmFzZScsXG4gICAgICAnb2JqZWN0fGRhdGEnLFxuICAgICAgJ3NjcmlwdHxzcmMnLFxuICAgIF0pO1xuICB9XG4gIHJldHVybiBfU0VDVVJJVFlfU0NIRU1BO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlckNvbnRleHQoY3R4OiBTZWN1cml0eUNvbnRleHQsIHNwZWNzOiBzdHJpbmdbXSkge1xuICBmb3IgKGNvbnN0IHNwZWMgb2Ygc3BlY3MpIF9TRUNVUklUWV9TQ0hFTUFbc3BlYy50b0xvd2VyQ2FzZSgpXSA9IGN0eDtcbn1cblxuLyoqXG4gKiBUaGUgc2V0IG9mIHNlY3VyaXR5LXNlbnNpdGl2ZSBhdHRyaWJ1dGVzIG9mIGFuIGA8aWZyYW1lPmAgdGhhdCAqbXVzdCogYmVcbiAqIGFwcGxpZWQgYXMgYSBzdGF0aWMgYXR0cmlidXRlIG9ubHkuIFRoaXMgZW5zdXJlcyB0aGF0IGFsbCBzZWN1cml0eS1zZW5zaXRpdmVcbiAqIGF0dHJpYnV0ZXMgYXJlIHRha2VuIGludG8gYWNjb3VudCB3aGlsZSBjcmVhdGluZyBhbiBpbnN0YW5jZSBvZiBhbiBgPGlmcmFtZT5gXG4gKiBhdCBydW50aW1lLlxuICpcbiAqIE5vdGU6IGF2b2lkIHVzaW5nIHRoaXMgc2V0IGRpcmVjdGx5LCB1c2UgdGhlIGBpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cmAgZnVuY3Rpb25cbiAqIGluIHRoZSBjb2RlIGluc3RlYWQuXG4gKi9cbmV4cG9ydCBjb25zdCBJRlJBTUVfU0VDVVJJVFlfU0VOU0lUSVZFX0FUVFJTID1cbiAgICBuZXcgU2V0KFsnc2FuZGJveCcsICdhbGxvdycsICdhbGxvd2Z1bGxzY3JlZW4nLCAncmVmZXJyZXJwb2xpY3knLCAnY3NwJywgJ2ZldGNocHJpb3JpdHknXSk7XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgYSBnaXZlbiBhdHRyaWJ1dGUgbmFtZSBtaWdodCByZXByZXNlbnQgYSBzZWN1cml0eS1zZW5zaXRpdmVcbiAqIGF0dHJpYnV0ZSBvZiBhbiA8aWZyYW1lPi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzSWZyYW1lU2VjdXJpdHlTZW5zaXRpdmVBdHRyKGF0dHJOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgLy8gVGhlIGBzZXRBdHRyaWJ1dGVgIERPTSBBUEkgaXMgY2FzZS1pbnNlbnNpdGl2ZSwgc28gd2UgbG93ZXJjYXNlIHRoZSB2YWx1ZVxuICAvLyBiZWZvcmUgY2hlY2tpbmcgaXQgYWdhaW5zdCBhIGtub3duIHNlY3VyaXR5LXNlbnNpdGl2ZSBhdHRyaWJ1dGVzLlxuICByZXR1cm4gSUZSQU1FX1NFQ1VSSVRZX1NFTlNJVElWRV9BVFRSUy5oYXMoYXR0ck5hbWUudG9Mb3dlckNhc2UoKSk7XG59XG4iXX0=