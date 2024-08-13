/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { RuntimeError } from '../render3/error_code';
import { getTemplateLocationDetails } from '../render3/instructions/element_validation';
import { RENDERER } from '../render3/interfaces/view';
import { nativeRemoveNode } from '../render3/node_manipulation';
import { getLView, getSelectedTNode } from '../render3/state';
import { getNativeByTNode } from '../render3/util/view_utils';
import { trustedHTMLFromString } from '../util/security/trusted_types';
/**
 * Validation function invoked at runtime for each binding that might potentially
 * represent a security-sensitive attribute of an <iframe>.
 * See `IFRAME_SECURITY_SENSITIVE_ATTRS` in the
 * `packages/compiler/src/schema/dom_security_schema.ts` script for the full list
 * of such attributes.
 *
 * @codeGenApi
 */
export function ɵɵvalidateIframeAttribute(attrValue, tagName, attrName) {
    const lView = getLView();
    const tNode = getSelectedTNode();
    const element = getNativeByTNode(tNode, lView);
    // Restrict any dynamic bindings of security-sensitive attributes/properties
    // on an <iframe> for security reasons.
    if (tNode.type === 2 /* Element */ && tagName.toLowerCase() === 'iframe') {
        const iframe = element;
        // Unset previously applied `src` and `srcdoc` if we come across a situation when
        // a security-sensitive attribute is set later via an attribute/property binding.
        iframe.src = '';
        iframe.srcdoc = trustedHTMLFromString('');
        // Also remove the <iframe> from the document.
        nativeRemoveNode(lView[RENDERER], iframe);
        const errorMessage = ngDevMode ? //
            `Angular has detected that the \`${attrName}\` was applied ` +
                `as a binding to an <iframe>${getTemplateLocationDetails(lView)}. ` +
                `For security reasons, the \`${attrName}\` can be set on an <iframe> ` +
                `as a static attribute only. \n` +
                `To fix this, switch the \`${attrName}\` binding to a static attribute ` +
                `in a template or in host bindings section.` :
            '';
        throw new RuntimeError("910" /* UNSAFE_IFRAME_ATTRS */, errorMessage);
    }
    return attrValue;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWZyYW1lX2F0dHJzX3ZhbGlkYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb3JlL3NyYy9zYW5pdGl6YXRpb24vaWZyYW1lX2F0dHJzX3ZhbGlkYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBbUIsTUFBTSx1QkFBdUIsQ0FBQztBQUNyRSxPQUFPLEVBQUMsMEJBQTBCLEVBQUMsTUFBTSw0Q0FBNEMsQ0FBQztBQUd0RixPQUFPLEVBQUMsUUFBUSxFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFDcEQsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDOUQsT0FBTyxFQUFDLFFBQVEsRUFBRSxnQkFBZ0IsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQzVELE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQzVELE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBR3JFOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxVQUFVLHlCQUF5QixDQUFDLFNBQWMsRUFBRSxPQUFlLEVBQUUsUUFBZ0I7SUFDekYsTUFBTSxLQUFLLEdBQUcsUUFBUSxFQUFFLENBQUM7SUFDekIsTUFBTSxLQUFLLEdBQUcsZ0JBQWdCLEVBQUcsQ0FBQztJQUNsQyxNQUFNLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUF3QixDQUFDO0lBRXRFLDRFQUE0RTtJQUM1RSx1Q0FBdUM7SUFDdkMsSUFBSSxLQUFLLENBQUMsSUFBSSxvQkFBc0IsSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssUUFBUSxFQUFFO1FBQzFFLE1BQU0sTUFBTSxHQUFHLE9BQTRCLENBQUM7UUFFNUMsaUZBQWlGO1FBQ2pGLGlGQUFpRjtRQUNqRixNQUFNLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUNoQixNQUFNLENBQUMsTUFBTSxHQUFHLHFCQUFxQixDQUFDLEVBQUUsQ0FBc0IsQ0FBQztRQUUvRCw4Q0FBOEM7UUFDOUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRTFDLE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUUsRUFBRTtZQUNoQyxtQ0FBbUMsUUFBUSxpQkFBaUI7Z0JBQ3hELDhCQUE4QiwwQkFBMEIsQ0FBQyxLQUFLLENBQUMsSUFBSTtnQkFDbkUsK0JBQStCLFFBQVEsK0JBQStCO2dCQUN0RSxnQ0FBZ0M7Z0JBQ2hDLDZCQUE2QixRQUFRLG1DQUFtQztnQkFDeEUsNENBQTRDLENBQUMsQ0FBQztZQUNsRCxFQUFFLENBQUM7UUFDUCxNQUFNLElBQUksWUFBWSxrQ0FBdUMsWUFBWSxDQUFDLENBQUM7S0FDNUU7SUFDRCxPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UnVudGltZUVycm9yLCBSdW50aW1lRXJyb3JDb2RlfSBmcm9tICcuLi9yZW5kZXIzL2Vycm9yX2NvZGUnO1xuaW1wb3J0IHtnZXRUZW1wbGF0ZUxvY2F0aW9uRGV0YWlsc30gZnJvbSAnLi4vcmVuZGVyMy9pbnN0cnVjdGlvbnMvZWxlbWVudF92YWxpZGF0aW9uJztcbmltcG9ydCB7VE5vZGVUeXBlfSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvbm9kZSc7XG5pbXBvcnQge1JDb21tZW50LCBSRWxlbWVudH0gZnJvbSAnLi4vcmVuZGVyMy9pbnRlcmZhY2VzL3JlbmRlcmVyX2RvbSc7XG5pbXBvcnQge1JFTkRFUkVSfSBmcm9tICcuLi9yZW5kZXIzL2ludGVyZmFjZXMvdmlldyc7XG5pbXBvcnQge25hdGl2ZVJlbW92ZU5vZGV9IGZyb20gJy4uL3JlbmRlcjMvbm9kZV9tYW5pcHVsYXRpb24nO1xuaW1wb3J0IHtnZXRMVmlldywgZ2V0U2VsZWN0ZWRUTm9kZX0gZnJvbSAnLi4vcmVuZGVyMy9zdGF0ZSc7XG5pbXBvcnQge2dldE5hdGl2ZUJ5VE5vZGV9IGZyb20gJy4uL3JlbmRlcjMvdXRpbC92aWV3X3V0aWxzJztcbmltcG9ydCB7dHJ1c3RlZEhUTUxGcm9tU3RyaW5nfSBmcm9tICcuLi91dGlsL3NlY3VyaXR5L3RydXN0ZWRfdHlwZXMnO1xuXG5cbi8qKlxuICogVmFsaWRhdGlvbiBmdW5jdGlvbiBpbnZva2VkIGF0IHJ1bnRpbWUgZm9yIGVhY2ggYmluZGluZyB0aGF0IG1pZ2h0IHBvdGVudGlhbGx5XG4gKiByZXByZXNlbnQgYSBzZWN1cml0eS1zZW5zaXRpdmUgYXR0cmlidXRlIG9mIGFuIDxpZnJhbWU+LlxuICogU2VlIGBJRlJBTUVfU0VDVVJJVFlfU0VOU0lUSVZFX0FUVFJTYCBpbiB0aGVcbiAqIGBwYWNrYWdlcy9jb21waWxlci9zcmMvc2NoZW1hL2RvbV9zZWN1cml0eV9zY2hlbWEudHNgIHNjcmlwdCBmb3IgdGhlIGZ1bGwgbGlzdFxuICogb2Ygc3VjaCBhdHRyaWJ1dGVzLlxuICpcbiAqIEBjb2RlR2VuQXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiDJtcm1dmFsaWRhdGVJZnJhbWVBdHRyaWJ1dGUoYXR0clZhbHVlOiBhbnksIHRhZ05hbWU6IHN0cmluZywgYXR0ck5hbWU6IHN0cmluZykge1xuICBjb25zdCBsVmlldyA9IGdldExWaWV3KCk7XG4gIGNvbnN0IHROb2RlID0gZ2V0U2VsZWN0ZWRUTm9kZSgpITtcbiAgY29uc3QgZWxlbWVudCA9IGdldE5hdGl2ZUJ5VE5vZGUodE5vZGUsIGxWaWV3KSBhcyBSRWxlbWVudCB8IFJDb21tZW50O1xuXG4gIC8vIFJlc3RyaWN0IGFueSBkeW5hbWljIGJpbmRpbmdzIG9mIHNlY3VyaXR5LXNlbnNpdGl2ZSBhdHRyaWJ1dGVzL3Byb3BlcnRpZXNcbiAgLy8gb24gYW4gPGlmcmFtZT4gZm9yIHNlY3VyaXR5IHJlYXNvbnMuXG4gIGlmICh0Tm9kZS50eXBlID09PSBUTm9kZVR5cGUuRWxlbWVudCAmJiB0YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdpZnJhbWUnKSB7XG4gICAgY29uc3QgaWZyYW1lID0gZWxlbWVudCBhcyBIVE1MSUZyYW1lRWxlbWVudDtcblxuICAgIC8vIFVuc2V0IHByZXZpb3VzbHkgYXBwbGllZCBgc3JjYCBhbmQgYHNyY2RvY2AgaWYgd2UgY29tZSBhY3Jvc3MgYSBzaXR1YXRpb24gd2hlblxuICAgIC8vIGEgc2VjdXJpdHktc2Vuc2l0aXZlIGF0dHJpYnV0ZSBpcyBzZXQgbGF0ZXIgdmlhIGFuIGF0dHJpYnV0ZS9wcm9wZXJ0eSBiaW5kaW5nLlxuICAgIGlmcmFtZS5zcmMgPSAnJztcbiAgICBpZnJhbWUuc3JjZG9jID0gdHJ1c3RlZEhUTUxGcm9tU3RyaW5nKCcnKSBhcyB1bmtub3duIGFzIHN0cmluZztcblxuICAgIC8vIEFsc28gcmVtb3ZlIHRoZSA8aWZyYW1lPiBmcm9tIHRoZSBkb2N1bWVudC5cbiAgICBuYXRpdmVSZW1vdmVOb2RlKGxWaWV3W1JFTkRFUkVSXSwgaWZyYW1lKTtcblxuICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IG5nRGV2TW9kZSA/ICAvL1xuICAgICAgICBgQW5ndWxhciBoYXMgZGV0ZWN0ZWQgdGhhdCB0aGUgXFxgJHthdHRyTmFtZX1cXGAgd2FzIGFwcGxpZWQgYCArXG4gICAgICAgICAgICBgYXMgYSBiaW5kaW5nIHRvIGFuIDxpZnJhbWU+JHtnZXRUZW1wbGF0ZUxvY2F0aW9uRGV0YWlscyhsVmlldyl9LiBgICtcbiAgICAgICAgICAgIGBGb3Igc2VjdXJpdHkgcmVhc29ucywgdGhlIFxcYCR7YXR0ck5hbWV9XFxgIGNhbiBiZSBzZXQgb24gYW4gPGlmcmFtZT4gYCArXG4gICAgICAgICAgICBgYXMgYSBzdGF0aWMgYXR0cmlidXRlIG9ubHkuIFxcbmAgK1xuICAgICAgICAgICAgYFRvIGZpeCB0aGlzLCBzd2l0Y2ggdGhlIFxcYCR7YXR0ck5hbWV9XFxgIGJpbmRpbmcgdG8gYSBzdGF0aWMgYXR0cmlidXRlIGAgK1xuICAgICAgICAgICAgYGluIGEgdGVtcGxhdGUgb3IgaW4gaG9zdCBiaW5kaW5ncyBzZWN0aW9uLmAgOlxuICAgICAgICAnJztcbiAgICB0aHJvdyBuZXcgUnVudGltZUVycm9yKFJ1bnRpbWVFcnJvckNvZGUuVU5TQUZFX0lGUkFNRV9BVFRSUywgZXJyb3JNZXNzYWdlKTtcbiAgfVxuICByZXR1cm4gYXR0clZhbHVlO1xufVxuIl19