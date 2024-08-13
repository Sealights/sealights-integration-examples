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
        define("@angular/compiler/src/render3/view/compiler", ["require", "exports", "tslib", "@angular/compiler/src/compiler_util/expression_converter", "@angular/compiler/src/core", "@angular/compiler/src/output/output_ast", "@angular/compiler/src/parse_util", "@angular/compiler/src/schema/dom_security_schema", "@angular/compiler/src/selector", "@angular/compiler/src/shadow_css", "@angular/compiler/src/style_compiler", "@angular/compiler/src/util", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/r3_identifiers", "@angular/compiler/src/render3/util", "@angular/compiler/src/render3/view/styling_builder", "@angular/compiler/src/render3/view/template", "@angular/compiler/src/render3/view/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.verifyHostBindings = exports.parseHostBindings = exports.createDirectiveType = exports.createDirectiveTypeParams = exports.createComponentType = exports.compileComponentFromMetadata = exports.compileDirectiveFromMetadata = void 0;
    var tslib_1 = require("tslib");
    var expression_converter_1 = require("@angular/compiler/src/compiler_util/expression_converter");
    var core = require("@angular/compiler/src/core");
    var o = require("@angular/compiler/src/output/output_ast");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var dom_security_schema_1 = require("@angular/compiler/src/schema/dom_security_schema");
    var selector_1 = require("@angular/compiler/src/selector");
    var shadow_css_1 = require("@angular/compiler/src/shadow_css");
    var style_compiler_1 = require("@angular/compiler/src/style_compiler");
    var util_1 = require("@angular/compiler/src/util");
    var r3_ast_1 = require("@angular/compiler/src/render3/r3_ast");
    var r3_identifiers_1 = require("@angular/compiler/src/render3/r3_identifiers");
    var util_2 = require("@angular/compiler/src/render3/util");
    var styling_builder_1 = require("@angular/compiler/src/render3/view/styling_builder");
    var template_1 = require("@angular/compiler/src/render3/view/template");
    var util_3 = require("@angular/compiler/src/render3/view/util");
    // This regex matches any binding names that contain the "attr." prefix, e.g. "attr.required"
    // If there is a match, the first matching group will contain the attribute name to bind.
    var ATTR_REGEX = /attr\.([^\]]+)/;
    function baseDirectiveFields(meta, constantPool, bindingParser) {
        var definitionMap = new util_3.DefinitionMap();
        var selectors = core.parseSelectorToR3Selector(meta.selector);
        // e.g. `type: MyDirective`
        definitionMap.set('type', meta.internalType);
        // e.g. `selectors: [['', 'someDir', '']]`
        if (selectors.length > 0) {
            definitionMap.set('selectors', util_3.asLiteral(selectors));
        }
        if (meta.queries.length > 0) {
            // e.g. `contentQueries: (rf, ctx, dirIndex) => { ... }
            definitionMap.set('contentQueries', createContentQueriesFunction(meta.queries, constantPool, meta.name));
        }
        if (meta.viewQueries.length) {
            definitionMap.set('viewQuery', createViewQueriesFunction(meta.viewQueries, constantPool, meta.name));
        }
        // e.g. `hostBindings: (rf, ctx) => { ... }
        definitionMap.set('hostBindings', createHostBindingsFunction(meta.host, meta.typeSourceSpan, bindingParser, constantPool, meta.selector || '', meta.name, definitionMap));
        // e.g 'inputs: {a: 'a'}`
        definitionMap.set('inputs', util_3.conditionallyCreateMapObjectLiteral(meta.inputs, true));
        // e.g 'outputs: {a: 'a'}`
        definitionMap.set('outputs', util_3.conditionallyCreateMapObjectLiteral(meta.outputs));
        if (meta.exportAs !== null) {
            definitionMap.set('exportAs', o.literalArr(meta.exportAs.map(function (e) { return o.literal(e); })));
        }
        return definitionMap;
    }
    /**
     * Add features to the definition map.
     */
    function addFeatures(definitionMap, meta) {
        // e.g. `features: [NgOnChangesFeature]`
        var features = [];
        var providers = meta.providers;
        var viewProviders = meta.viewProviders;
        if (providers || viewProviders) {
            var args = [providers || new o.LiteralArrayExpr([])];
            if (viewProviders) {
                args.push(viewProviders);
            }
            features.push(o.importExpr(r3_identifiers_1.Identifiers.ProvidersFeature).callFn(args));
        }
        if (meta.usesInheritance) {
            features.push(o.importExpr(r3_identifiers_1.Identifiers.InheritDefinitionFeature));
        }
        if (meta.fullInheritance) {
            features.push(o.importExpr(r3_identifiers_1.Identifiers.CopyDefinitionFeature));
        }
        if (meta.lifecycle.usesOnChanges) {
            features.push(o.importExpr(r3_identifiers_1.Identifiers.NgOnChangesFeature));
        }
        if (features.length) {
            definitionMap.set('features', o.literalArr(features));
        }
    }
    /**
     * Compile a directive for the render3 runtime as defined by the `R3DirectiveMetadata`.
     */
    function compileDirectiveFromMetadata(meta, constantPool, bindingParser) {
        var definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
        addFeatures(definitionMap, meta);
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineDirective).callFn([definitionMap.toLiteralMap()], undefined, true);
        var type = createDirectiveType(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileDirectiveFromMetadata = compileDirectiveFromMetadata;
    /**
     * Compile a component for the render3 runtime as defined by the `R3ComponentMetadata`.
     */
    function compileComponentFromMetadata(meta, constantPool, bindingParser) {
        var e_1, _a;
        var definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
        addFeatures(definitionMap, meta);
        var selector = meta.selector && selector_1.CssSelector.parse(meta.selector);
        var firstSelector = selector && selector[0];
        // e.g. `attr: ["class", ".my.app"]`
        // This is optional an only included if the first selector of a component specifies attributes.
        if (firstSelector) {
            var selectorAttributes = firstSelector.getAttrs();
            if (selectorAttributes.length) {
                definitionMap.set('attrs', constantPool.getConstLiteral(o.literalArr(selectorAttributes.map(function (value) { return value != null ? o.literal(value) : o.literal(undefined); })), 
                /* forceShared */ true));
            }
        }
        // Generate the CSS matcher that recognize directive
        var directiveMatcher = null;
        if (meta.directives.length > 0) {
            var matcher = new selector_1.SelectorMatcher();
            try {
                for (var _b = tslib_1.__values(meta.directives), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var _d = _c.value, selector_2 = _d.selector, type_1 = _d.type;
                    matcher.addSelectables(selector_1.CssSelector.parse(selector_2), type_1);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            directiveMatcher = matcher;
        }
        // e.g. `template: function MyComponent_Template(_ctx, _cm) {...}`
        var templateTypeName = meta.name;
        var templateName = templateTypeName ? templateTypeName + "_Template" : null;
        var directivesUsed = new Set();
        var pipesUsed = new Set();
        var changeDetection = meta.changeDetection;
        var template = meta.template;
        var templateBuilder = new template_1.TemplateDefinitionBuilder(constantPool, template_1.BindingScope.createRootScope(), 0, templateTypeName, null, null, templateName, directiveMatcher, directivesUsed, meta.pipes, pipesUsed, r3_identifiers_1.Identifiers.namespaceHTML, meta.relativeContextFilePath, meta.i18nUseExternalIds);
        var templateFunctionExpression = templateBuilder.buildTemplateFunction(template.nodes, []);
        // We need to provide this so that dynamically generated components know what
        // projected content blocks to pass through to the component when it is instantiated.
        var ngContentSelectors = templateBuilder.getNgContentSelectors();
        if (ngContentSelectors) {
            definitionMap.set('ngContentSelectors', ngContentSelectors);
        }
        // e.g. `decls: 2`
        definitionMap.set('decls', o.literal(templateBuilder.getConstCount()));
        // e.g. `vars: 2`
        definitionMap.set('vars', o.literal(templateBuilder.getVarCount()));
        // Generate `consts` section of ComponentDef:
        // - either as an array:
        //   `consts: [['one', 'two'], ['three', 'four']]`
        // - or as a factory function in case additional statements are present (to support i18n):
        //   `consts: function() { var i18n_0; if (ngI18nClosureMode) {...} else {...} return [i18n_0]; }`
        var _e = templateBuilder.getConsts(), constExpressions = _e.constExpressions, prepareStatements = _e.prepareStatements;
        if (constExpressions.length > 0) {
            var constsExpr = o.literalArr(constExpressions);
            // Prepare statements are present - turn `consts` into a function.
            if (prepareStatements.length > 0) {
                constsExpr = o.fn([], tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(prepareStatements)), [new o.ReturnStatement(constsExpr)]));
            }
            definitionMap.set('consts', constsExpr);
        }
        definitionMap.set('template', templateFunctionExpression);
        // e.g. `directives: [MyDirective]`
        if (directivesUsed.size) {
            var directivesList = o.literalArr(Array.from(directivesUsed));
            var directivesExpr = compileDeclarationList(directivesList, meta.declarationListEmitMode);
            definitionMap.set('directives', directivesExpr);
        }
        // e.g. `pipes: [MyPipe]`
        if (pipesUsed.size) {
            var pipesList = o.literalArr(Array.from(pipesUsed));
            var pipesExpr = compileDeclarationList(pipesList, meta.declarationListEmitMode);
            definitionMap.set('pipes', pipesExpr);
        }
        if (meta.encapsulation === null) {
            meta.encapsulation = core.ViewEncapsulation.Emulated;
        }
        // e.g. `styles: [str1, str2]`
        if (meta.styles && meta.styles.length) {
            var styleValues = meta.encapsulation == core.ViewEncapsulation.Emulated ?
                compileStyles(meta.styles, style_compiler_1.CONTENT_ATTR, style_compiler_1.HOST_ATTR) :
                meta.styles;
            var strings = styleValues.map(function (str) { return constantPool.getConstLiteral(o.literal(str)); });
            definitionMap.set('styles', o.literalArr(strings));
        }
        else if (meta.encapsulation === core.ViewEncapsulation.Emulated) {
            // If there is no style, don't generate css selectors on elements
            meta.encapsulation = core.ViewEncapsulation.None;
        }
        // Only set view encapsulation if it's not the default value
        if (meta.encapsulation !== core.ViewEncapsulation.Emulated) {
            definitionMap.set('encapsulation', o.literal(meta.encapsulation));
        }
        // e.g. `animation: [trigger('123', [])]`
        if (meta.animations !== null) {
            definitionMap.set('data', o.literalMap([{ key: 'animation', value: meta.animations, quoted: false }]));
        }
        // Only set the change detection flag if it's defined and it's not the default.
        if (changeDetection != null && changeDetection !== core.ChangeDetectionStrategy.Default) {
            definitionMap.set('changeDetection', o.literal(changeDetection));
        }
        var expression = o.importExpr(r3_identifiers_1.Identifiers.defineComponent).callFn([definitionMap.toLiteralMap()], undefined, true);
        var type = createComponentType(meta);
        return { expression: expression, type: type, statements: [] };
    }
    exports.compileComponentFromMetadata = compileComponentFromMetadata;
    /**
     * Creates the type specification from the component meta. This type is inserted into .d.ts files
     * to be consumed by upstream compilations.
     */
    function createComponentType(meta) {
        var typeParams = createDirectiveTypeParams(meta);
        typeParams.push(stringArrayAsType(meta.template.ngContentSelectors));
        return o.expressionType(o.importExpr(r3_identifiers_1.Identifiers.ComponentDeclaration, typeParams));
    }
    exports.createComponentType = createComponentType;
    /**
     * Compiles the array literal of declarations into an expression according to the provided emit
     * mode.
     */
    function compileDeclarationList(list, mode) {
        switch (mode) {
            case 0 /* Direct */:
                // directives: [MyDir],
                return list;
            case 1 /* Closure */:
                // directives: function () { return [MyDir]; }
                return o.fn([], [new o.ReturnStatement(list)]);
            case 2 /* ClosureResolved */:
                // directives: function () { return [MyDir].map(ng.resolveForwardRef); }
                var resolvedList = list.callMethod('map', [o.importExpr(r3_identifiers_1.Identifiers.resolveForwardRef)]);
                return o.fn([], [new o.ReturnStatement(resolvedList)]);
        }
    }
    function prepareQueryParams(query, constantPool) {
        var parameters = [util_3.getQueryPredicate(query, constantPool), o.literal(toQueryFlags(query))];
        if (query.read) {
            parameters.push(query.read);
        }
        return parameters;
    }
    /**
     * Translates query flags into `TQueryFlags` type in packages/core/src/render3/interfaces/query.ts
     * @param query
     */
    function toQueryFlags(query) {
        return (query.descendants ? 1 /* descendants */ : 0 /* none */) |
            (query.static ? 2 /* isStatic */ : 0 /* none */) |
            (query.emitDistinctChangesOnly ? 4 /* emitDistinctChangesOnly */ : 0 /* none */);
    }
    function convertAttributesToExpressions(attributes) {
        var e_2, _a;
        var values = [];
        try {
            for (var _b = tslib_1.__values(Object.getOwnPropertyNames(attributes)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                var value = attributes[key];
                values.push(o.literal(key), value);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return values;
    }
    // Define and update any content queries
    function createContentQueriesFunction(queries, constantPool, name) {
        var e_3, _a;
        var createStatements = [];
        var updateStatements = [];
        var tempAllocator = util_3.temporaryAllocator(updateStatements, util_3.TEMPORARY_NAME);
        try {
            for (var queries_1 = tslib_1.__values(queries), queries_1_1 = queries_1.next(); !queries_1_1.done; queries_1_1 = queries_1.next()) {
                var query = queries_1_1.value;
                // creation, e.g. r3.contentQuery(dirIndex, somePredicate, true, null);
                createStatements.push(o.importExpr(r3_identifiers_1.Identifiers.contentQuery)
                    .callFn(tslib_1.__spreadArray([o.variable('dirIndex')], tslib_1.__read(prepareQueryParams(query, constantPool))))
                    .toStmt());
                // update, e.g. (r3.queryRefresh(tmp = r3.loadQuery()) && (ctx.someDir = tmp));
                var temporary = tempAllocator();
                var getQueryList = o.importExpr(r3_identifiers_1.Identifiers.loadQuery).callFn([]);
                var refresh = o.importExpr(r3_identifiers_1.Identifiers.queryRefresh).callFn([temporary.set(getQueryList)]);
                var updateDirective = o.variable(util_3.CONTEXT_NAME)
                    .prop(query.propertyName)
                    .set(query.first ? temporary.prop('first') : temporary);
                updateStatements.push(refresh.and(updateDirective).toStmt());
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (queries_1_1 && !queries_1_1.done && (_a = queries_1.return)) _a.call(queries_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        var contentQueriesFnName = name ? name + "_ContentQueries" : null;
        return o.fn([
            new o.FnParam(util_3.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_3.CONTEXT_NAME, null),
            new o.FnParam('dirIndex', null)
        ], [
            template_1.renderFlagCheckIfStmt(1 /* Create */, createStatements),
            template_1.renderFlagCheckIfStmt(2 /* Update */, updateStatements)
        ], o.INFERRED_TYPE, null, contentQueriesFnName);
    }
    function stringAsType(str) {
        return o.expressionType(o.literal(str));
    }
    function stringMapAsType(map) {
        var mapValues = Object.keys(map).map(function (key) {
            var value = Array.isArray(map[key]) ? map[key][0] : map[key];
            return {
                key: key,
                value: o.literal(value),
                quoted: true,
            };
        });
        return o.expressionType(o.literalMap(mapValues));
    }
    function stringArrayAsType(arr) {
        return arr.length > 0 ? o.expressionType(o.literalArr(arr.map(function (value) { return o.literal(value); }))) :
            o.NONE_TYPE;
    }
    function createDirectiveTypeParams(meta) {
        // On the type side, remove newlines from the selector as it will need to fit into a TypeScript
        // string literal, which must be on one line.
        var selectorForType = meta.selector !== null ? meta.selector.replace(/\n/g, '') : null;
        return [
            util_2.typeWithParameters(meta.type.type, meta.typeArgumentCount),
            selectorForType !== null ? stringAsType(selectorForType) : o.NONE_TYPE,
            meta.exportAs !== null ? stringArrayAsType(meta.exportAs) : o.NONE_TYPE,
            stringMapAsType(meta.inputs),
            stringMapAsType(meta.outputs),
            stringArrayAsType(meta.queries.map(function (q) { return q.propertyName; })),
        ];
    }
    exports.createDirectiveTypeParams = createDirectiveTypeParams;
    /**
     * Creates the type specification from the directive meta. This type is inserted into .d.ts files
     * to be consumed by upstream compilations.
     */
    function createDirectiveType(meta) {
        var typeParams = createDirectiveTypeParams(meta);
        return o.expressionType(o.importExpr(r3_identifiers_1.Identifiers.DirectiveDeclaration, typeParams));
    }
    exports.createDirectiveType = createDirectiveType;
    // Define and update any view queries
    function createViewQueriesFunction(viewQueries, constantPool, name) {
        var createStatements = [];
        var updateStatements = [];
        var tempAllocator = util_3.temporaryAllocator(updateStatements, util_3.TEMPORARY_NAME);
        viewQueries.forEach(function (query) {
            // creation, e.g. r3.viewQuery(somePredicate, true);
            var queryDefinition = o.importExpr(r3_identifiers_1.Identifiers.viewQuery).callFn(prepareQueryParams(query, constantPool));
            createStatements.push(queryDefinition.toStmt());
            // update, e.g. (r3.queryRefresh(tmp = r3.loadQuery()) && (ctx.someDir = tmp));
            var temporary = tempAllocator();
            var getQueryList = o.importExpr(r3_identifiers_1.Identifiers.loadQuery).callFn([]);
            var refresh = o.importExpr(r3_identifiers_1.Identifiers.queryRefresh).callFn([temporary.set(getQueryList)]);
            var updateDirective = o.variable(util_3.CONTEXT_NAME)
                .prop(query.propertyName)
                .set(query.first ? temporary.prop('first') : temporary);
            updateStatements.push(refresh.and(updateDirective).toStmt());
        });
        var viewQueryFnName = name ? name + "_Query" : null;
        return o.fn([new o.FnParam(util_3.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_3.CONTEXT_NAME, null)], [
            template_1.renderFlagCheckIfStmt(1 /* Create */, createStatements),
            template_1.renderFlagCheckIfStmt(2 /* Update */, updateStatements)
        ], o.INFERRED_TYPE, null, viewQueryFnName);
    }
    // Return a host binding function or null if one is not necessary.
    function createHostBindingsFunction(hostBindingsMetadata, typeSourceSpan, bindingParser, constantPool, selector, name, definitionMap) {
        var bindingContext = o.variable(util_3.CONTEXT_NAME);
        var styleBuilder = new styling_builder_1.StylingBuilder(bindingContext);
        var _a = hostBindingsMetadata.specialAttributes, styleAttr = _a.styleAttr, classAttr = _a.classAttr;
        if (styleAttr !== undefined) {
            styleBuilder.registerStyleAttr(styleAttr);
        }
        if (classAttr !== undefined) {
            styleBuilder.registerClassAttr(classAttr);
        }
        var createStatements = [];
        var updateStatements = [];
        var hostBindingSourceSpan = typeSourceSpan;
        var directiveSummary = metadataAsSummary(hostBindingsMetadata);
        // Calculate host event bindings
        var eventBindings = bindingParser.createDirectiveHostEventAsts(directiveSummary, hostBindingSourceSpan);
        if (eventBindings && eventBindings.length) {
            var listeners = createHostListeners(eventBindings, name);
            createStatements.push.apply(createStatements, tslib_1.__spreadArray([], tslib_1.__read(listeners)));
        }
        // Calculate the host property bindings
        var bindings = bindingParser.createBoundHostProperties(directiveSummary, hostBindingSourceSpan);
        var allOtherBindings = [];
        // We need to calculate the total amount of binding slots required by
        // all the instructions together before any value conversions happen.
        // Value conversions may require additional slots for interpolation and
        // bindings with pipes. These calculates happen after this block.
        var totalHostVarsCount = 0;
        bindings && bindings.forEach(function (binding) {
            var stylingInputWasSet = styleBuilder.registerInputBasedOnName(binding.name, binding.expression, hostBindingSourceSpan);
            if (stylingInputWasSet) {
                totalHostVarsCount += styling_builder_1.MIN_STYLING_BINDING_SLOTS_REQUIRED;
            }
            else {
                allOtherBindings.push(binding);
                totalHostVarsCount++;
            }
        });
        var valueConverter;
        var getValueConverter = function () {
            if (!valueConverter) {
                var hostVarsCountFn = function (numSlots) {
                    var originalVarsCount = totalHostVarsCount;
                    totalHostVarsCount += numSlots;
                    return originalVarsCount;
                };
                valueConverter = new template_1.ValueConverter(constantPool, function () { return util_1.error('Unexpected node'); }, // new nodes are illegal here
                hostVarsCountFn, function () { return util_1.error('Unexpected pipe'); }); // pipes are illegal here
            }
            return valueConverter;
        };
        var propertyBindings = [];
        var attributeBindings = [];
        var syntheticHostBindings = [];
        allOtherBindings.forEach(function (binding) {
            // resolve literal arrays and literal objects
            var value = binding.expression.visit(getValueConverter());
            var bindingExpr = bindingFn(bindingContext, value);
            var _a = getBindingNameAndInstruction(binding), bindingName = _a.bindingName, instruction = _a.instruction, isAttribute = _a.isAttribute;
            var securityContexts = bindingParser.calcPossibleSecurityContexts(selector, bindingName, isAttribute)
                .filter(function (context) { return context !== core.SecurityContext.NONE; });
            var sanitizerFn = null;
            if (securityContexts.length) {
                if (securityContexts.length === 2 &&
                    securityContexts.indexOf(core.SecurityContext.URL) > -1 &&
                    securityContexts.indexOf(core.SecurityContext.RESOURCE_URL) > -1) {
                    // Special case for some URL attributes (such as "src" and "href") that may be a part
                    // of different security contexts. In this case we use special sanitization function and
                    // select the actual sanitizer at runtime based on a tag name that is provided while
                    // invoking sanitization function.
                    sanitizerFn = o.importExpr(r3_identifiers_1.Identifiers.sanitizeUrlOrResourceUrl);
                }
                else {
                    sanitizerFn = template_1.resolveSanitizationFn(securityContexts[0], isAttribute);
                }
            }
            var instructionParams = [o.literal(bindingName), bindingExpr.currValExpr];
            if (sanitizerFn) {
                instructionParams.push(sanitizerFn);
            }
            else {
                // If there was no sanitization function found based on the security context
                // of an attribute/property binding - check whether this attribute/property is
                // one of the security-sensitive <iframe> attributes.
                // Note: for host bindings defined on a directive, we do not try to find all
                // possible places where it can be matched, so we can not determine whether
                // the host element is an <iframe>. In this case, if an attribute/binding
                // name is in the `IFRAME_SECURITY_SENSITIVE_ATTRS` set - append a validation
                // function, which would be invoked at runtime and would have access to the
                // underlying DOM element, check if it's an <iframe> and if so - runs extra checks.
                if (dom_security_schema_1.isIframeSecuritySensitiveAttr(bindingName)) {
                    instructionParams.push(o.importExpr(r3_identifiers_1.Identifiers.validateIframeAttribute));
                }
            }
            updateStatements.push.apply(updateStatements, tslib_1.__spreadArray([], tslib_1.__read(bindingExpr.stmts)));
            if (instruction === r3_identifiers_1.Identifiers.hostProperty) {
                propertyBindings.push(instructionParams);
            }
            else if (instruction === r3_identifiers_1.Identifiers.attribute) {
                attributeBindings.push(instructionParams);
            }
            else if (instruction === r3_identifiers_1.Identifiers.syntheticHostProperty) {
                syntheticHostBindings.push(instructionParams);
            }
            else {
                updateStatements.push(o.importExpr(instruction).callFn(instructionParams).toStmt());
            }
        });
        if (propertyBindings.length > 0) {
            updateStatements.push(util_3.chainedInstruction(r3_identifiers_1.Identifiers.hostProperty, propertyBindings).toStmt());
        }
        if (attributeBindings.length > 0) {
            updateStatements.push(util_3.chainedInstruction(r3_identifiers_1.Identifiers.attribute, attributeBindings).toStmt());
        }
        if (syntheticHostBindings.length > 0) {
            updateStatements.push(util_3.chainedInstruction(r3_identifiers_1.Identifiers.syntheticHostProperty, syntheticHostBindings).toStmt());
        }
        // since we're dealing with directives/components and both have hostBinding
        // functions, we need to generate a special hostAttrs instruction that deals
        // with both the assignment of styling as well as static attributes to the host
        // element. The instruction below will instruct all initial styling (styling
        // that is inside of a host binding within a directive/component) to be attached
        // to the host element alongside any of the provided host attributes that were
        // collected earlier.
        var hostAttrs = convertAttributesToExpressions(hostBindingsMetadata.attributes);
        styleBuilder.assignHostAttrs(hostAttrs, definitionMap);
        if (styleBuilder.hasBindings) {
            // finally each binding that was registered in the statement above will need to be added to
            // the update block of a component/directive templateFn/hostBindingsFn so that the bindings
            // are evaluated and updated for the element.
            styleBuilder.buildUpdateLevelInstructions(getValueConverter()).forEach(function (instruction) {
                if (instruction.calls.length > 0) {
                    var calls_1 = [];
                    instruction.calls.forEach(function (call) {
                        // we subtract a value of `1` here because the binding slot was already allocated
                        // at the top of this method when all the input bindings were counted.
                        totalHostVarsCount +=
                            Math.max(call.allocateBindingSlots - styling_builder_1.MIN_STYLING_BINDING_SLOTS_REQUIRED, 0);
                        calls_1.push(convertStylingCall(call, bindingContext, bindingFn));
                    });
                    updateStatements.push(util_3.chainedInstruction(instruction.reference, calls_1).toStmt());
                }
            });
        }
        if (totalHostVarsCount) {
            definitionMap.set('hostVars', o.literal(totalHostVarsCount));
        }
        if (createStatements.length > 0 || updateStatements.length > 0) {
            var hostBindingsFnName = name ? name + "_HostBindings" : null;
            var statements = [];
            if (createStatements.length > 0) {
                statements.push(template_1.renderFlagCheckIfStmt(1 /* Create */, createStatements));
            }
            if (updateStatements.length > 0) {
                statements.push(template_1.renderFlagCheckIfStmt(2 /* Update */, updateStatements));
            }
            return o.fn([new o.FnParam(util_3.RENDER_FLAGS, o.NUMBER_TYPE), new o.FnParam(util_3.CONTEXT_NAME, null)], statements, o.INFERRED_TYPE, null, hostBindingsFnName);
        }
        return null;
    }
    function bindingFn(implicit, value) {
        return expression_converter_1.convertPropertyBinding(null, implicit, value, 'b', expression_converter_1.BindingForm.Expression, function () { return util_1.error('Unexpected interpolation'); });
    }
    function convertStylingCall(call, bindingContext, bindingFn) {
        return call.params(function (value) { return bindingFn(bindingContext, value).currValExpr; });
    }
    function getBindingNameAndInstruction(binding) {
        var bindingName = binding.name;
        var instruction;
        // Check to see if this is an attr binding or a property binding
        var attrMatches = bindingName.match(ATTR_REGEX);
        if (attrMatches) {
            bindingName = attrMatches[1];
            instruction = r3_identifiers_1.Identifiers.attribute;
        }
        else {
            if (binding.isAnimation) {
                bindingName = util_2.prepareSyntheticPropertyName(bindingName);
                // host bindings that have a synthetic property (e.g. @foo) should always be rendered
                // in the context of the component and not the parent. Therefore there is a special
                // compatibility instruction available for this purpose.
                instruction = r3_identifiers_1.Identifiers.syntheticHostProperty;
            }
            else {
                instruction = r3_identifiers_1.Identifiers.hostProperty;
            }
        }
        return { bindingName: bindingName, instruction: instruction, isAttribute: !!attrMatches };
    }
    function createHostListeners(eventBindings, name) {
        var listeners = [];
        var syntheticListeners = [];
        var instructions = [];
        eventBindings.forEach(function (binding) {
            var bindingName = binding.name && parse_util_1.sanitizeIdentifier(binding.name);
            var bindingFnName = binding.type === 1 /* Animation */ ?
                util_2.prepareSyntheticListenerFunctionName(bindingName, binding.targetOrPhase) :
                bindingName;
            var handlerName = name && bindingName ? name + "_" + bindingFnName + "_HostBindingHandler" : null;
            var params = template_1.prepareEventListenerParameters(r3_ast_1.BoundEvent.fromParsedEvent(binding), handlerName);
            if (binding.type == 1 /* Animation */) {
                syntheticListeners.push(params);
            }
            else {
                listeners.push(params);
            }
        });
        if (syntheticListeners.length > 0) {
            instructions.push(util_3.chainedInstruction(r3_identifiers_1.Identifiers.syntheticHostListener, syntheticListeners).toStmt());
        }
        if (listeners.length > 0) {
            instructions.push(util_3.chainedInstruction(r3_identifiers_1.Identifiers.listener, listeners).toStmt());
        }
        return instructions;
    }
    function metadataAsSummary(meta) {
        // clang-format off
        return {
            // This is used by the BindingParser, which only deals with listeners and properties. There's no
            // need to pass attributes to it.
            hostAttributes: {},
            hostListeners: meta.listeners,
            hostProperties: meta.properties,
        };
        // clang-format on
    }
    var HOST_REG_EXP = /^(?:\[([^\]]+)\])|(?:\(([^\)]+)\))$/;
    function parseHostBindings(host) {
        var e_4, _a;
        var attributes = {};
        var listeners = {};
        var properties = {};
        var specialAttributes = {};
        try {
            for (var _b = tslib_1.__values(Object.keys(host)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var key = _c.value;
                var value = host[key];
                var matches = key.match(HOST_REG_EXP);
                if (matches === null) {
                    switch (key) {
                        case 'class':
                            if (typeof value !== 'string') {
                                // TODO(alxhub): make this a diagnostic.
                                throw new Error("Class binding must be string");
                            }
                            specialAttributes.classAttr = value;
                            break;
                        case 'style':
                            if (typeof value !== 'string') {
                                // TODO(alxhub): make this a diagnostic.
                                throw new Error("Style binding must be string");
                            }
                            specialAttributes.styleAttr = value;
                            break;
                        default:
                            if (typeof value === 'string') {
                                attributes[key] = o.literal(value);
                            }
                            else {
                                attributes[key] = value;
                            }
                    }
                }
                else if (matches[1 /* Binding */] != null) {
                    if (typeof value !== 'string') {
                        // TODO(alxhub): make this a diagnostic.
                        throw new Error("Property binding must be string");
                    }
                    // synthetic properties (the ones that have a `@` as a prefix)
                    // are still treated the same as regular properties. Therefore
                    // there is no point in storing them in a separate map.
                    properties[matches[1 /* Binding */]] = value;
                }
                else if (matches[2 /* Event */] != null) {
                    if (typeof value !== 'string') {
                        // TODO(alxhub): make this a diagnostic.
                        throw new Error("Event binding must be string");
                    }
                    listeners[matches[2 /* Event */]] = value;
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return { attributes: attributes, listeners: listeners, properties: properties, specialAttributes: specialAttributes };
    }
    exports.parseHostBindings = parseHostBindings;
    /**
     * Verifies host bindings and returns the list of errors (if any). Empty array indicates that a
     * given set of host bindings has no errors.
     *
     * @param bindings set of host bindings to verify.
     * @param sourceSpan source span where host bindings were defined.
     * @returns array of errors associated with a given set of host bindings.
     */
    function verifyHostBindings(bindings, sourceSpan) {
        var summary = metadataAsSummary(bindings);
        // TODO: abstract out host bindings verification logic and use it instead of
        // creating events and properties ASTs to detect errors (FW-996)
        var bindingParser = template_1.makeBindingParser();
        bindingParser.createDirectiveHostEventAsts(summary, sourceSpan);
        bindingParser.createBoundHostProperties(summary, sourceSpan);
        return bindingParser.errors;
    }
    exports.verifyHostBindings = verifyHostBindings;
    function compileStyles(styles, selector, hostSelector) {
        var shadowCss = new shadow_css_1.ShadowCss();
        return styles.map(function (style) {
            return shadowCss.shimCssText(style, selector, hostSelector);
        });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGlsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci9zcmMvcmVuZGVyMy92aWV3L2NvbXBpbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFHSCxpR0FBNkY7SUFFN0YsaURBQW1DO0lBRW5DLDJEQUE2QztJQUM3QywrREFBaUY7SUFDakYsd0ZBQStFO0lBQy9FLDJEQUE0RDtJQUM1RCwrREFBMkM7SUFDM0MsdUVBQTZEO0lBRTdELG1EQUFpQztJQUNqQywrREFBcUM7SUFDckMsK0VBQW9EO0lBQ3BELDJEQUFxSTtJQUdySSxzRkFBNkc7SUFDN0csd0VBQW9MO0lBQ3BMLGdFQUE0TDtJQUc1TCw2RkFBNkY7SUFDN0YseUZBQXlGO0lBQ3pGLElBQU0sVUFBVSxHQUFHLGdCQUFnQixDQUFDO0lBRXBDLFNBQVMsbUJBQW1CLENBQ3hCLElBQXlCLEVBQUUsWUFBMEIsRUFDckQsYUFBNEI7UUFDOUIsSUFBTSxhQUFhLEdBQUcsSUFBSSxvQkFBYSxFQUFFLENBQUM7UUFDMUMsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVoRSwyQkFBMkI7UUFDM0IsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTdDLDBDQUEwQztRQUMxQyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ3hCLGFBQWEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLGdCQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztTQUN0RDtRQUVELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQzNCLHVEQUF1RDtZQUN2RCxhQUFhLENBQUMsR0FBRyxDQUNiLGdCQUFnQixF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QixrQkFBa0IsQ0FDOUIsUUFBNEIsRUFBRSxVQUEyQjtRQUMzRCxJQUFNLE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM1Qyw0RUFBNEU7UUFDNUUsZ0VBQWdFO1FBQ2hFLElBQU0sYUFBYSxHQUFHLDRCQUFpQixFQUFFLENBQUM7UUFDMUMsYUFBYSxDQUFDLDRCQUE0QixDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNoRSxhQUFhLENBQUMseUJBQXlCLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzdELE9BQU8sYUFBYSxDQUFDLE1BQU0sQ0FBQztJQUM5QixDQUFDO0lBVEQsZ0RBU0M7SUFFRCxTQUFTLGFBQWEsQ0FBQyxNQUFnQixFQUFFLFFBQWdCLEVBQUUsWUFBb0I7UUFDN0UsSUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBUyxFQUFFLENBQUM7UUFDbEMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSztZQUNyQixPQUFPLFNBQVUsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUMvRCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDb21waWxlRGlyZWN0aXZlU3VtbWFyeX0gZnJvbSAnLi4vLi4vY29tcGlsZV9tZXRhZGF0YSc7XG5pbXBvcnQge0JpbmRpbmdGb3JtLCBjb252ZXJ0UHJvcGVydHlCaW5kaW5nfSBmcm9tICcuLi8uLi9jb21waWxlcl91dGlsL2V4cHJlc3Npb25fY29udmVydGVyJztcbmltcG9ydCB7Q29uc3RhbnRQb29sfSBmcm9tICcuLi8uLi9jb25zdGFudF9wb29sJztcbmltcG9ydCAqIGFzIGNvcmUgZnJvbSAnLi4vLi4vY29yZSc7XG5pbXBvcnQge0FTVCwgUGFyc2VkRXZlbnQsIFBhcnNlZEV2ZW50VHlwZSwgUGFyc2VkUHJvcGVydHl9IGZyb20gJy4uLy4uL2V4cHJlc3Npb25fcGFyc2VyL2FzdCc7XG5pbXBvcnQgKiBhcyBvIGZyb20gJy4uLy4uL291dHB1dC9vdXRwdXRfYXN0JztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VTb3VyY2VTcGFuLCBzYW5pdGl6ZUlkZW50aWZpZXJ9IGZyb20gJy4uLy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtpc0lmcmFtZVNlY3VyaXR5U2Vuc2l0aXZlQXR0cn0gZnJvbSAnLi4vLi4vc2NoZW1hL2RvbV9zZWN1cml0eV9zY2hlbWEnO1xuaW1wb3J0IHtDc3NTZWxlY3RvciwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICcuLi8uLi9zZWxlY3Rvcic7XG5pbXBvcnQge1NoYWRvd0Nzc30gZnJvbSAnLi4vLi4vc2hhZG93X2Nzcyc7XG5pbXBvcnQge0NPTlRFTlRfQVRUUiwgSE9TVF9BVFRSfSBmcm9tICcuLi8uLi9zdHlsZV9jb21waWxlcic7XG5pbXBvcnQge0JpbmRpbmdQYXJzZXJ9IGZyb20gJy4uLy4uL3RlbXBsYXRlX3BhcnNlci9iaW5kaW5nX3BhcnNlcic7XG5pbXBvcnQge2Vycm9yfSBmcm9tICcuLi8uLi91dGlsJztcbmltcG9ydCB7Qm91bmRFdmVudH0gZnJvbSAnLi4vcjNfYXN0JztcbmltcG9ydCB7SWRlbnRpZmllcnMgYXMgUjN9IGZyb20gJy4uL3IzX2lkZW50aWZpZXJzJztcbmltcG9ydCB7cHJlcGFyZVN5bnRoZXRpY0xpc3RlbmVyRnVuY3Rpb25OYW1lLCBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lLCBSM0NvbXBpbGVkRXhwcmVzc2lvbiwgdHlwZVdpdGhQYXJhbWV0ZXJzfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0IHtEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSwgUjNDb21wb25lbnRNZXRhZGF0YSwgUjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNIb3N0TWV0YWRhdGEsIFIzUXVlcnlNZXRhZGF0YX0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtNSU5fU1RZTElOR19CSU5ESU5HX1NMT1RTX1JFUVVJUkVELCBTdHlsaW5nQnVpbGRlciwgU3R5bGluZ0luc3RydWN0aW9uQ2FsbH0gZnJvbSAnLi9zdHlsaW5nX2J1aWxkZXInO1xuaW1wb3J0IHtCaW5kaW5nU2NvcGUsIG1ha2VCaW5kaW5nUGFyc2VyLCBwcmVwYXJlRXZlbnRMaXN0ZW5lclBhcmFtZXRlcnMsIHJlbmRlckZsYWdDaGVja0lmU3RtdCwgcmVzb2x2ZVNhbml0aXphdGlvbkZuLCBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLCBWYWx1ZUNvbnZlcnRlcn0gZnJvbSAnLi90ZW1wbGF0ZSc7XG5pbXBvcnQge2FzTGl0ZXJhbCwgY2hhaW5lZEluc3RydWN0aW9uLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbCwgQ09OVEVYVF9OQU1FLCBEZWZpbml0aW9uTWFwLCBnZXRRdWVyeVByZWRpY2F0ZSwgUkVOREVSX0ZMQUdTLCBURU1QT1JBUllfTkFNRSwgdGVtcG9yYXJ5QWxsb2NhdG9yfSBmcm9tICcuL3V0aWwnO1xuXG5cbi8vIFRoaXMgcmVnZXggbWF0Y2hlcyBhbnkgYmluZGluZyBuYW1lcyB0aGF0IGNvbnRhaW4gdGhlIFwiYXR0ci5cIiBwcmVmaXgsIGUuZy4gXCJhdHRyLnJlcXVpcmVkXCJcbi8vIElmIHRoZXJlIGlzIGEgbWF0Y2gsIHRoZSBmaXJzdCBtYXRjaGluZyBncm91cCB3aWxsIGNvbnRhaW4gdGhlIGF0dHJpYnV0ZSBuYW1lIHRvIGJpbmQuXG5jb25zdCBBVFRSX1JFR0VYID0gL2F0dHJcXC4oW15cXF1dKykvO1xuXG5mdW5jdGlvbiBiYXNlRGlyZWN0aXZlRmllbGRzKFxuICAgIG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBEZWZpbml0aW9uTWFwIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IG5ldyBEZWZpbml0aW9uTWFwKCk7XG4gIGNvbnN0IHNlbGVjdG9ycyA9IGNvcmUucGFyc2VTZWxlY3RvclRvUjNTZWxlY3RvcihtZXRhLnNlbGVjdG9yKTtcblxuICAvLyBlLmcuIGB0eXBlOiBNeURpcmVjdGl2ZWBcbiAgZGVmaW5pdGlvbk1hcC5zZXQoJ3R5cGUnLCBtZXRhLmludGVybmFsVHlwZSk7XG5cbiAgLy8gZS5nLiBgc2VsZWN0b3JzOiBbWycnLCAnc29tZURpcicsICcnXV1gXG4gIGlmIChzZWxlY3RvcnMubGVuZ3RoID4gMCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdzZWxlY3RvcnMnLCBhc0xpdGVyYWwoc2VsZWN0b3JzKSk7XG4gIH1cblxuICBpZiAobWV0YS5xdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAvLyBlLmcuIGBjb250ZW50UXVlcmllczogKHJmLCBjdHgsIGRpckluZGV4KSA9PiB7IC4uLiB9XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdjb250ZW50UXVlcmllcycsIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24obWV0YS5xdWVyaWVzLCBjb25zdGFudFBvb2wsIG1ldGEubmFtZSkpO1xuICB9XG5cbiAgaWYgKG1ldGEudmlld1F1ZXJpZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICd2aWV3UXVlcnknLCBjcmVhdGVWaWV3UXVlcmllc0Z1bmN0aW9uKG1ldGEudmlld1F1ZXJpZXMsIGNvbnN0YW50UG9vbCwgbWV0YS5uYW1lKSk7XG4gIH1cblxuICAvLyBlLmcuIGBob3N0QmluZGluZ3M6IChyZiwgY3R4KSA9PiB7IC4uLiB9XG4gIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgJ2hvc3RCaW5kaW5ncycsXG4gICAgICBjcmVhdGVIb3N0QmluZGluZ3NGdW5jdGlvbihcbiAgICAgICAgICBtZXRhLmhvc3QsIG1ldGEudHlwZVNvdXJjZVNwYW4sIGJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbCwgbWV0YS5zZWxlY3RvciB8fCAnJyxcbiAgICAgICAgICBtZXRhLm5hbWUsIGRlZmluaXRpb25NYXApKTtcblxuICAvLyBlLmcgJ2lucHV0czoge2E6ICdhJ31gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdpbnB1dHMnLCBjb25kaXRpb25hbGx5Q3JlYXRlTWFwT2JqZWN0TGl0ZXJhbChtZXRhLmlucHV0cywgdHJ1ZSkpO1xuXG4gIC8vIGUuZyAnb3V0cHV0czoge2E6ICdhJ31gXG4gIGRlZmluaXRpb25NYXAuc2V0KCdvdXRwdXRzJywgY29uZGl0aW9uYWxseUNyZWF0ZU1hcE9iamVjdExpdGVyYWwobWV0YS5vdXRwdXRzKSk7XG5cbiAgaWYgKG1ldGEuZXhwb3J0QXMgIT09IG51bGwpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZXhwb3J0QXMnLCBvLmxpdGVyYWxBcnIobWV0YS5leHBvcnRBcy5tYXAoZSA9PiBvLmxpdGVyYWwoZSkpKSk7XG4gIH1cblxuICByZXR1cm4gZGVmaW5pdGlvbk1hcDtcbn1cblxuLyoqXG4gKiBBZGQgZmVhdHVyZXMgdG8gdGhlIGRlZmluaXRpb24gbWFwLlxuICovXG5mdW5jdGlvbiBhZGRGZWF0dXJlcyhkZWZpbml0aW9uTWFwOiBEZWZpbml0aW9uTWFwLCBtZXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhfFIzQ29tcG9uZW50TWV0YWRhdGEpIHtcbiAgLy8gZS5nLiBgZmVhdHVyZXM6IFtOZ09uQ2hhbmdlc0ZlYXR1cmVdYFxuICBjb25zdCBmZWF0dXJlczogby5FeHByZXNzaW9uW10gPSBbXTtcblxuICBjb25zdCBwcm92aWRlcnMgPSBtZXRhLnByb3ZpZGVycztcbiAgY29uc3Qgdmlld1Byb3ZpZGVycyA9IChtZXRhIGFzIFIzQ29tcG9uZW50TWV0YWRhdGEpLnZpZXdQcm92aWRlcnM7XG4gIGlmIChwcm92aWRlcnMgfHwgdmlld1Byb3ZpZGVycykge1xuICAgIGNvbnN0IGFyZ3MgPSBbcHJvdmlkZXJzIHx8IG5ldyBvLkxpdGVyYWxBcnJheUV4cHIoW10pXTtcbiAgICBpZiAodmlld1Byb3ZpZGVycykge1xuICAgICAgYXJncy5wdXNoKHZpZXdQcm92aWRlcnMpO1xuICAgIH1cbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5Qcm92aWRlcnNGZWF0dXJlKS5jYWxsRm4oYXJncykpO1xuICB9XG5cbiAgaWYgKG1ldGEudXNlc0luaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuSW5oZXJpdERlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEuZnVsbEluaGVyaXRhbmNlKSB7XG4gICAgZmVhdHVyZXMucHVzaChvLmltcG9ydEV4cHIoUjMuQ29weURlZmluaXRpb25GZWF0dXJlKSk7XG4gIH1cbiAgaWYgKG1ldGEubGlmZWN5Y2xlLnVzZXNPbkNoYW5nZXMpIHtcbiAgICBmZWF0dXJlcy5wdXNoKG8uaW1wb3J0RXhwcihSMy5OZ09uQ2hhbmdlc0ZlYXR1cmUpKTtcbiAgfVxuICBpZiAoZmVhdHVyZXMubGVuZ3RoKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2ZlYXR1cmVzJywgby5saXRlcmFsQXJyKGZlYXR1cmVzKSk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb21waWxlIGEgZGlyZWN0aXZlIGZvciB0aGUgcmVuZGVyMyBydW50aW1lIGFzIGRlZmluZWQgYnkgdGhlIGBSM0RpcmVjdGl2ZU1ldGFkYXRhYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEoXG4gICAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wsXG4gICAgYmluZGluZ1BhcnNlcjogQmluZGluZ1BhcnNlcik6IFIzQ29tcGlsZWRFeHByZXNzaW9uIHtcbiAgY29uc3QgZGVmaW5pdGlvbk1hcCA9IGJhc2VEaXJlY3RpdmVGaWVsZHMobWV0YSwgY29uc3RhbnRQb29sLCBiaW5kaW5nUGFyc2VyKTtcbiAgYWRkRmVhdHVyZXMoZGVmaW5pdGlvbk1hcCwgbWV0YSk7XG4gIGNvbnN0IGV4cHJlc3Npb24gPVxuICAgICAgby5pbXBvcnRFeHByKFIzLmRlZmluZURpcmVjdGl2ZSkuY2FsbEZuKFtkZWZpbml0aW9uTWFwLnRvTGl0ZXJhbE1hcCgpXSwgdW5kZWZpbmVkLCB0cnVlKTtcbiAgY29uc3QgdHlwZSA9IGNyZWF0ZURpcmVjdGl2ZVR5cGUobWV0YSk7XG5cbiAgcmV0dXJuIHtleHByZXNzaW9uLCB0eXBlLCBzdGF0ZW1lbnRzOiBbXX07XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIGNvbXBvbmVudCBmb3IgdGhlIHJlbmRlcjMgcnVudGltZSBhcyBkZWZpbmVkIGJ5IHRoZSBgUjNDb21wb25lbnRNZXRhZGF0YWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQ29tcG9uZW50RnJvbU1ldGFkYXRhKFxuICAgIG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSM0NvbXBpbGVkRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGRlZmluaXRpb25NYXAgPSBiYXNlRGlyZWN0aXZlRmllbGRzKG1ldGEsIGNvbnN0YW50UG9vbCwgYmluZGluZ1BhcnNlcik7XG4gIGFkZEZlYXR1cmVzKGRlZmluaXRpb25NYXAsIG1ldGEpO1xuXG4gIGNvbnN0IHNlbGVjdG9yID0gbWV0YS5zZWxlY3RvciAmJiBDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKTtcbiAgY29uc3QgZmlyc3RTZWxlY3RvciA9IHNlbGVjdG9yICYmIHNlbGVjdG9yWzBdO1xuXG4gIC8vIGUuZy4gYGF0dHI6IFtcImNsYXNzXCIsIFwiLm15LmFwcFwiXWBcbiAgLy8gVGhpcyBpcyBvcHRpb25hbCBhbiBvbmx5IGluY2x1ZGVkIGlmIHRoZSBmaXJzdCBzZWxlY3RvciBvZiBhIGNvbXBvbmVudCBzcGVjaWZpZXMgYXR0cmlidXRlcy5cbiAgaWYgKGZpcnN0U2VsZWN0b3IpIHtcbiAgICBjb25zdCBzZWxlY3RvckF0dHJpYnV0ZXMgPSBmaXJzdFNlbGVjdG9yLmdldEF0dHJzKCk7XG4gICAgaWYgKHNlbGVjdG9yQXR0cmlidXRlcy5sZW5ndGgpIHtcbiAgICAgIGRlZmluaXRpb25NYXAuc2V0KFxuICAgICAgICAgICdhdHRycycsXG4gICAgICAgICAgY29uc3RhbnRQb29sLmdldENvbnN0TGl0ZXJhbChcbiAgICAgICAgICAgICAgby5saXRlcmFsQXJyKHNlbGVjdG9yQXR0cmlidXRlcy5tYXAoXG4gICAgICAgICAgICAgICAgICB2YWx1ZSA9PiB2YWx1ZSAhPSBudWxsID8gby5saXRlcmFsKHZhbHVlKSA6IG8ubGl0ZXJhbCh1bmRlZmluZWQpKSksXG4gICAgICAgICAgICAgIC8qIGZvcmNlU2hhcmVkICovIHRydWUpKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZW5lcmF0ZSB0aGUgQ1NTIG1hdGNoZXIgdGhhdCByZWNvZ25pemUgZGlyZWN0aXZlXG4gIGxldCBkaXJlY3RpdmVNYXRjaGVyOiBTZWxlY3Rvck1hdGNoZXJ8bnVsbCA9IG51bGw7XG5cbiAgaWYgKG1ldGEuZGlyZWN0aXZlcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBTZWxlY3Rvck1hdGNoZXIoKTtcbiAgICBmb3IgKGNvbnN0IHtzZWxlY3RvciwgdHlwZX0gb2YgbWV0YS5kaXJlY3RpdmVzKSB7XG4gICAgICBtYXRjaGVyLmFkZFNlbGVjdGFibGVzKENzc1NlbGVjdG9yLnBhcnNlKHNlbGVjdG9yKSwgdHlwZSk7XG4gICAgfVxuICAgIGRpcmVjdGl2ZU1hdGNoZXIgPSBtYXRjaGVyO1xuICB9XG5cbiAgLy8gZS5nLiBgdGVtcGxhdGU6IGZ1bmN0aW9uIE15Q29tcG9uZW50X1RlbXBsYXRlKF9jdHgsIF9jbSkgey4uLn1gXG4gIGNvbnN0IHRlbXBsYXRlVHlwZU5hbWUgPSBtZXRhLm5hbWU7XG4gIGNvbnN0IHRlbXBsYXRlTmFtZSA9IHRlbXBsYXRlVHlwZU5hbWUgPyBgJHt0ZW1wbGF0ZVR5cGVOYW1lfV9UZW1wbGF0ZWAgOiBudWxsO1xuXG4gIGNvbnN0IGRpcmVjdGl2ZXNVc2VkID0gbmV3IFNldDxvLkV4cHJlc3Npb24+KCk7XG4gIGNvbnN0IHBpcGVzVXNlZCA9IG5ldyBTZXQ8by5FeHByZXNzaW9uPigpO1xuICBjb25zdCBjaGFuZ2VEZXRlY3Rpb24gPSBtZXRhLmNoYW5nZURldGVjdGlvbjtcblxuICBjb25zdCB0ZW1wbGF0ZSA9IG1ldGEudGVtcGxhdGU7XG4gIGNvbnN0IHRlbXBsYXRlQnVpbGRlciA9IG5ldyBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyKFxuICAgICAgY29uc3RhbnRQb29sLCBCaW5kaW5nU2NvcGUuY3JlYXRlUm9vdFNjb3BlKCksIDAsIHRlbXBsYXRlVHlwZU5hbWUsIG51bGwsIG51bGwsIHRlbXBsYXRlTmFtZSxcbiAgICAgIGRpcmVjdGl2ZU1hdGNoZXIsIGRpcmVjdGl2ZXNVc2VkLCBtZXRhLnBpcGVzLCBwaXBlc1VzZWQsIFIzLm5hbWVzcGFjZUhUTUwsXG4gICAgICBtZXRhLnJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLCBtZXRhLmkxOG5Vc2VFeHRlcm5hbElkcyk7XG5cbiAgY29uc3QgdGVtcGxhdGVGdW5jdGlvbkV4cHJlc3Npb24gPSB0ZW1wbGF0ZUJ1aWxkZXIuYnVpbGRUZW1wbGF0ZUZ1bmN0aW9uKHRlbXBsYXRlLm5vZGVzLCBbXSk7XG5cbiAgLy8gV2UgbmVlZCB0byBwcm92aWRlIHRoaXMgc28gdGhhdCBkeW5hbWljYWxseSBnZW5lcmF0ZWQgY29tcG9uZW50cyBrbm93IHdoYXRcbiAgLy8gcHJvamVjdGVkIGNvbnRlbnQgYmxvY2tzIHRvIHBhc3MgdGhyb3VnaCB0byB0aGUgY29tcG9uZW50IHdoZW4gaXQgaXMgaW5zdGFudGlhdGVkLlxuICBjb25zdCBuZ0NvbnRlbnRTZWxlY3RvcnMgPSB0ZW1wbGF0ZUJ1aWxkZXIuZ2V0TmdDb250ZW50U2VsZWN0b3JzKCk7XG4gIGlmIChuZ0NvbnRlbnRTZWxlY3RvcnMpIHtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnbmdDb250ZW50U2VsZWN0b3JzJywgbmdDb250ZW50U2VsZWN0b3JzKTtcbiAgfVxuXG4gIC8vIGUuZy4gYGRlY2xzOiAyYFxuICBkZWZpbml0aW9uTWFwLnNldCgnZGVjbHMnLCBvLmxpdGVyYWwodGVtcGxhdGVCdWlsZGVyLmdldENvbnN0Q291bnQoKSkpO1xuXG4gIC8vIGUuZy4gYHZhcnM6IDJgXG4gIGRlZmluaXRpb25NYXAuc2V0KCd2YXJzJywgby5saXRlcmFsKHRlbXBsYXRlQnVpbGRlci5nZXRWYXJDb3VudCgpKSk7XG5cbiAgLy8gR2VuZXJhdGUgYGNvbnN0c2Agc2VjdGlvbiBvZiBDb21wb25lbnREZWY6XG4gIC8vIC0gZWl0aGVyIGFzIGFuIGFycmF5OlxuICAvLyAgIGBjb25zdHM6IFtbJ29uZScsICd0d28nXSwgWyd0aHJlZScsICdmb3VyJ11dYFxuICAvLyAtIG9yIGFzIGEgZmFjdG9yeSBmdW5jdGlvbiBpbiBjYXNlIGFkZGl0aW9uYWwgc3RhdGVtZW50cyBhcmUgcHJlc2VudCAodG8gc3VwcG9ydCBpMThuKTpcbiAgLy8gICBgY29uc3RzOiBmdW5jdGlvbigpIHsgdmFyIGkxOG5fMDsgaWYgKG5nSTE4bkNsb3N1cmVNb2RlKSB7Li4ufSBlbHNlIHsuLi59IHJldHVybiBbaTE4bl8wXTsgfWBcbiAgY29uc3Qge2NvbnN0RXhwcmVzc2lvbnMsIHByZXBhcmVTdGF0ZW1lbnRzfSA9IHRlbXBsYXRlQnVpbGRlci5nZXRDb25zdHMoKTtcbiAgaWYgKGNvbnN0RXhwcmVzc2lvbnMubGVuZ3RoID4gMCkge1xuICAgIGxldCBjb25zdHNFeHByOiBvLkxpdGVyYWxBcnJheUV4cHJ8by5GdW5jdGlvbkV4cHIgPSBvLmxpdGVyYWxBcnIoY29uc3RFeHByZXNzaW9ucyk7XG4gICAgLy8gUHJlcGFyZSBzdGF0ZW1lbnRzIGFyZSBwcmVzZW50IC0gdHVybiBgY29uc3RzYCBpbnRvIGEgZnVuY3Rpb24uXG4gICAgaWYgKHByZXBhcmVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0c0V4cHIgPSBvLmZuKFtdLCBbLi4ucHJlcGFyZVN0YXRlbWVudHMsIG5ldyBvLlJldHVyblN0YXRlbWVudChjb25zdHNFeHByKV0pO1xuICAgIH1cbiAgICBkZWZpbml0aW9uTWFwLnNldCgnY29uc3RzJywgY29uc3RzRXhwcik7XG4gIH1cblxuICBkZWZpbml0aW9uTWFwLnNldCgndGVtcGxhdGUnLCB0ZW1wbGF0ZUZ1bmN0aW9uRXhwcmVzc2lvbik7XG5cbiAgLy8gZS5nLiBgZGlyZWN0aXZlczogW015RGlyZWN0aXZlXWBcbiAgaWYgKGRpcmVjdGl2ZXNVc2VkLnNpemUpIHtcbiAgICBjb25zdCBkaXJlY3RpdmVzTGlzdCA9IG8ubGl0ZXJhbEFycihBcnJheS5mcm9tKGRpcmVjdGl2ZXNVc2VkKSk7XG4gICAgY29uc3QgZGlyZWN0aXZlc0V4cHIgPSBjb21waWxlRGVjbGFyYXRpb25MaXN0KGRpcmVjdGl2ZXNMaXN0LCBtZXRhLmRlY2xhcmF0aW9uTGlzdEVtaXRNb2RlKTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnZGlyZWN0aXZlcycsIGRpcmVjdGl2ZXNFeHByKTtcbiAgfVxuXG4gIC8vIGUuZy4gYHBpcGVzOiBbTXlQaXBlXWBcbiAgaWYgKHBpcGVzVXNlZC5zaXplKSB7XG4gICAgY29uc3QgcGlwZXNMaXN0ID0gby5saXRlcmFsQXJyKEFycmF5LmZyb20ocGlwZXNVc2VkKSk7XG4gICAgY29uc3QgcGlwZXNFeHByID0gY29tcGlsZURlY2xhcmF0aW9uTGlzdChwaXBlc0xpc3QsIG1ldGEuZGVjbGFyYXRpb25MaXN0RW1pdE1vZGUpO1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdwaXBlcycsIHBpcGVzRXhwcik7XG4gIH1cblxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uID09PSBudWxsKSB7XG4gICAgbWV0YS5lbmNhcHN1bGF0aW9uID0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZDtcbiAgfVxuXG4gIC8vIGUuZy4gYHN0eWxlczogW3N0cjEsIHN0cjJdYFxuICBpZiAobWV0YS5zdHlsZXMgJiYgbWV0YS5zdHlsZXMubGVuZ3RoKSB7XG4gICAgY29uc3Qgc3R5bGVWYWx1ZXMgPSBtZXRhLmVuY2Fwc3VsYXRpb24gPT0gY29yZS5WaWV3RW5jYXBzdWxhdGlvbi5FbXVsYXRlZCA/XG4gICAgICAgIGNvbXBpbGVTdHlsZXMobWV0YS5zdHlsZXMsIENPTlRFTlRfQVRUUiwgSE9TVF9BVFRSKSA6XG4gICAgICAgIG1ldGEuc3R5bGVzO1xuICAgIGNvbnN0IHN0cmluZ3MgPSBzdHlsZVZhbHVlcy5tYXAoc3RyID0+IGNvbnN0YW50UG9vbC5nZXRDb25zdExpdGVyYWwoby5saXRlcmFsKHN0cikpKTtcbiAgICBkZWZpbml0aW9uTWFwLnNldCgnc3R5bGVzJywgby5saXRlcmFsQXJyKHN0cmluZ3MpKTtcbiAgfSBlbHNlIGlmIChtZXRhLmVuY2Fwc3VsYXRpb24gPT09IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uRW11bGF0ZWQpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBzdHlsZSwgZG9uJ3QgZ2VuZXJhdGUgY3NzIHNlbGVjdG9ycyBvbiBlbGVtZW50c1xuICAgIG1ldGEuZW5jYXBzdWxhdGlvbiA9IGNvcmUuVmlld0VuY2Fwc3VsYXRpb24uTm9uZTtcbiAgfVxuXG4gIC8vIE9ubHkgc2V0IHZpZXcgZW5jYXBzdWxhdGlvbiBpZiBpdCdzIG5vdCB0aGUgZGVmYXVsdCB2YWx1ZVxuICBpZiAobWV0YS5lbmNhcHN1bGF0aW9uICE9PSBjb3JlLlZpZXdFbmNhcHN1bGF0aW9uLkVtdWxhdGVkKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2VuY2Fwc3VsYXRpb24nLCBvLmxpdGVyYWwobWV0YS5lbmNhcHN1bGF0aW9uKSk7XG4gIH1cblxuICAvLyBlLmcuIGBhbmltYXRpb246IFt0cmlnZ2VyKCcxMjMnLCBbXSldYFxuICBpZiAobWV0YS5hbmltYXRpb25zICE9PSBudWxsKSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoXG4gICAgICAgICdkYXRhJywgby5saXRlcmFsTWFwKFt7a2V5OiAnYW5pbWF0aW9uJywgdmFsdWU6IG1ldGEuYW5pbWF0aW9ucywgcXVvdGVkOiBmYWxzZX1dKSk7XG4gIH1cblxuICAvLyBPbmx5IHNldCB0aGUgY2hhbmdlIGRldGVjdGlvbiBmbGFnIGlmIGl0J3MgZGVmaW5lZCBhbmQgaXQncyBub3QgdGhlIGRlZmF1bHQuXG4gIGlmIChjaGFuZ2VEZXRlY3Rpb24gIT0gbnVsbCAmJiBjaGFuZ2VEZXRlY3Rpb24gIT09IGNvcmUuQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuRGVmYXVsdCkge1xuICAgIGRlZmluaXRpb25NYXAuc2V0KCdjaGFuZ2VEZXRlY3Rpb24nLCBvLmxpdGVyYWwoY2hhbmdlRGV0ZWN0aW9uKSk7XG4gIH1cblxuICBjb25zdCBleHByZXNzaW9uID1cbiAgICAgIG8uaW1wb3J0RXhwcihSMy5kZWZpbmVDb21wb25lbnQpLmNhbGxGbihbZGVmaW5pdGlvbk1hcC50b0xpdGVyYWxNYXAoKV0sIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gIGNvbnN0IHR5cGUgPSBjcmVhdGVDb21wb25lbnRUeXBlKG1ldGEpO1xuXG4gIHJldHVybiB7ZXhwcmVzc2lvbiwgdHlwZSwgc3RhdGVtZW50czogW119O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIHR5cGUgc3BlY2lmaWNhdGlvbiBmcm9tIHRoZSBjb21wb25lbnQgbWV0YS4gVGhpcyB0eXBlIGlzIGluc2VydGVkIGludG8gLmQudHMgZmlsZXNcbiAqIHRvIGJlIGNvbnN1bWVkIGJ5IHVwc3RyZWFtIGNvbXBpbGF0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudFR5cGUobWV0YTogUjNDb21wb25lbnRNZXRhZGF0YSk6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVQYXJhbXMgPSBjcmVhdGVEaXJlY3RpdmVUeXBlUGFyYW1zKG1ldGEpO1xuICB0eXBlUGFyYW1zLnB1c2goc3RyaW5nQXJyYXlBc1R5cGUobWV0YS50ZW1wbGF0ZS5uZ0NvbnRlbnRTZWxlY3RvcnMpKTtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5pbXBvcnRFeHByKFIzLkNvbXBvbmVudERlY2xhcmF0aW9uLCB0eXBlUGFyYW1zKSk7XG59XG5cbi8qKlxuICogQ29tcGlsZXMgdGhlIGFycmF5IGxpdGVyYWwgb2YgZGVjbGFyYXRpb25zIGludG8gYW4gZXhwcmVzc2lvbiBhY2NvcmRpbmcgdG8gdGhlIHByb3ZpZGVkIGVtaXRcbiAqIG1vZGUuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVEZWNsYXJhdGlvbkxpc3QoXG4gICAgbGlzdDogby5MaXRlcmFsQXJyYXlFeHByLCBtb2RlOiBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZSk6IG8uRXhwcmVzc2lvbiB7XG4gIHN3aXRjaCAobW9kZSkge1xuICAgIGNhc2UgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuRGlyZWN0OlxuICAgICAgLy8gZGlyZWN0aXZlczogW015RGlyXSxcbiAgICAgIHJldHVybiBsaXN0O1xuICAgIGNhc2UgRGVjbGFyYXRpb25MaXN0RW1pdE1vZGUuQ2xvc3VyZTpcbiAgICAgIC8vIGRpcmVjdGl2ZXM6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFtNeURpcl07IH1cbiAgICAgIHJldHVybiBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KGxpc3QpXSk7XG4gICAgY2FzZSBEZWNsYXJhdGlvbkxpc3RFbWl0TW9kZS5DbG9zdXJlUmVzb2x2ZWQ6XG4gICAgICAvLyBkaXJlY3RpdmVzOiBmdW5jdGlvbiAoKSB7IHJldHVybiBbTXlEaXJdLm1hcChuZy5yZXNvbHZlRm9yd2FyZFJlZik7IH1cbiAgICAgIGNvbnN0IHJlc29sdmVkTGlzdCA9IGxpc3QuY2FsbE1ldGhvZCgnbWFwJywgW28uaW1wb3J0RXhwcihSMy5yZXNvbHZlRm9yd2FyZFJlZildKTtcbiAgICAgIHJldHVybiBvLmZuKFtdLCBbbmV3IG8uUmV0dXJuU3RhdGVtZW50KHJlc29sdmVkTGlzdCldKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmVwYXJlUXVlcnlQYXJhbXMocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSwgY29uc3RhbnRQb29sOiBDb25zdGFudFBvb2wpOiBvLkV4cHJlc3Npb25bXSB7XG4gIGNvbnN0IHBhcmFtZXRlcnMgPSBbZ2V0UXVlcnlQcmVkaWNhdGUocXVlcnksIGNvbnN0YW50UG9vbCksIG8ubGl0ZXJhbCh0b1F1ZXJ5RmxhZ3MocXVlcnkpKV07XG4gIGlmIChxdWVyeS5yZWFkKSB7XG4gICAgcGFyYW1ldGVycy5wdXNoKHF1ZXJ5LnJlYWQpO1xuICB9XG4gIHJldHVybiBwYXJhbWV0ZXJzO1xufVxuXG4vKipcbiAqIEEgc2V0IG9mIGZsYWdzIHRvIGJlIHVzZWQgd2l0aCBRdWVyaWVzLlxuICpcbiAqIE5PVEU6IEVuc3VyZSBjaGFuZ2VzIGhlcmUgYXJlIGluIHN5bmMgd2l0aCBgcGFja2FnZXMvY29yZS9zcmMvcmVuZGVyMy9pbnRlcmZhY2VzL3F1ZXJ5LnRzYFxuICovXG5leHBvcnQgY29uc3QgZW51bSBRdWVyeUZsYWdzIHtcbiAgLyoqXG4gICAqIE5vIGZsYWdzXG4gICAqL1xuICBub25lID0gMGIwMDAwLFxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIG9yIG5vdCB0aGUgcXVlcnkgc2hvdWxkIGRlc2NlbmQgaW50byBjaGlsZHJlbi5cbiAgICovXG4gIGRlc2NlbmRhbnRzID0gMGIwMDAxLFxuXG4gIC8qKlxuICAgKiBUaGUgcXVlcnkgY2FuIGJlIGNvbXB1dGVkIHN0YXRpY2FsbHkgYW5kIGhlbmNlIGNhbiBiZSBhc3NpZ25lZCBlYWdlcmx5LlxuICAgKlxuICAgKiBOT1RFOiBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIFZpZXdFbmdpbmUuXG4gICAqL1xuICBpc1N0YXRpYyA9IDBiMDAxMCxcblxuICAvKipcbiAgICogSWYgdGhlIGBRdWVyeUxpc3RgIHNob3VsZCBmaXJlIGNoYW5nZSBldmVudCBvbmx5IGlmIGFjdHVhbCBjaGFuZ2UgdG8gcXVlcnkgd2FzIGNvbXB1dGVkICh2cyBvbGRcbiAgICogYmVoYXZpb3Igd2hlcmUgdGhlIGNoYW5nZSB3YXMgZmlyZWQgd2hlbmV2ZXIgdGhlIHF1ZXJ5IHdhcyByZWNvbXB1dGVkLCBldmVuIGlmIHRoZSByZWNvbXB1dGVkXG4gICAqIHF1ZXJ5IHJlc3VsdGVkIGluIHRoZSBzYW1lIGxpc3QuKVxuICAgKi9cbiAgZW1pdERpc3RpbmN0Q2hhbmdlc09ubHkgPSAwYjAxMDAsXG59XG5cbi8qKlxuICogVHJhbnNsYXRlcyBxdWVyeSBmbGFncyBpbnRvIGBUUXVlcnlGbGFnc2AgdHlwZSBpbiBwYWNrYWdlcy9jb3JlL3NyYy9yZW5kZXIzL2ludGVyZmFjZXMvcXVlcnkudHNcbiAqIEBwYXJhbSBxdWVyeVxuICovXG5mdW5jdGlvbiB0b1F1ZXJ5RmxhZ3MocXVlcnk6IFIzUXVlcnlNZXRhZGF0YSk6IG51bWJlciB7XG4gIHJldHVybiAocXVlcnkuZGVzY2VuZGFudHMgPyBRdWVyeUZsYWdzLmRlc2NlbmRhbnRzIDogUXVlcnlGbGFncy5ub25lKSB8XG4gICAgICAocXVlcnkuc3RhdGljID8gUXVlcnlGbGFncy5pc1N0YXRpYyA6IFF1ZXJ5RmxhZ3Mubm9uZSkgfFxuICAgICAgKHF1ZXJ5LmVtaXREaXN0aW5jdENoYW5nZXNPbmx5ID8gUXVlcnlGbGFncy5lbWl0RGlzdGluY3RDaGFuZ2VzT25seSA6IFF1ZXJ5RmxhZ3Mubm9uZSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhhdHRyaWJ1dGVzOiB7W25hbWU6IHN0cmluZ106IG8uRXhwcmVzc2lvbn0pOlxuICAgIG8uRXhwcmVzc2lvbltdIHtcbiAgY29uc3QgdmFsdWVzOiBvLkV4cHJlc3Npb25bXSA9IFtdO1xuICBmb3IgKGxldCBrZXkgb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoYXR0cmlidXRlcykpIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF0dHJpYnV0ZXNba2V5XTtcbiAgICB2YWx1ZXMucHVzaChvLmxpdGVyYWwoa2V5KSwgdmFsdWUpO1xuICB9XG4gIHJldHVybiB2YWx1ZXM7XG59XG5cbi8vIERlZmluZSBhbmQgdXBkYXRlIGFueSBjb250ZW50IHF1ZXJpZXNcbmZ1bmN0aW9uIGNyZWF0ZUNvbnRlbnRRdWVyaWVzRnVuY3Rpb24oXG4gICAgcXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIGZvciAoY29uc3QgcXVlcnkgb2YgcXVlcmllcykge1xuICAgIC8vIGNyZWF0aW9uLCBlLmcuIHIzLmNvbnRlbnRRdWVyeShkaXJJbmRleCwgc29tZVByZWRpY2F0ZSwgdHJ1ZSwgbnVsbCk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKFxuICAgICAgICBvLmltcG9ydEV4cHIoUjMuY29udGVudFF1ZXJ5KVxuICAgICAgICAgICAgLmNhbGxGbihbby52YXJpYWJsZSgnZGlySW5kZXgnKSwgLi4ucHJlcGFyZVF1ZXJ5UGFyYW1zKHF1ZXJ5LCBjb25zdGFudFBvb2wpIGFzIGFueV0pXG4gICAgICAgICAgICAudG9TdG10KCkpO1xuXG4gICAgLy8gdXBkYXRlLCBlLmcuIChyMy5xdWVyeVJlZnJlc2godG1wID0gcjMubG9hZFF1ZXJ5KCkpICYmIChjdHguc29tZURpciA9IHRtcCkpO1xuICAgIGNvbnN0IHRlbXBvcmFyeSA9IHRlbXBBbGxvY2F0b3IoKTtcbiAgICBjb25zdCBnZXRRdWVyeUxpc3QgPSBvLmltcG9ydEV4cHIoUjMubG9hZFF1ZXJ5KS5jYWxsRm4oW10pO1xuICAgIGNvbnN0IHJlZnJlc2ggPSBvLmltcG9ydEV4cHIoUjMucXVlcnlSZWZyZXNoKS5jYWxsRm4oW3RlbXBvcmFyeS5zZXQoZ2V0UXVlcnlMaXN0KV0pO1xuICAgIGNvbnN0IHVwZGF0ZURpcmVjdGl2ZSA9IG8udmFyaWFibGUoQ09OVEVYVF9OQU1FKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucHJvcChxdWVyeS5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXQocXVlcnkuZmlyc3QgPyB0ZW1wb3JhcnkucHJvcCgnZmlyc3QnKSA6IHRlbXBvcmFyeSk7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKHJlZnJlc2guYW5kKHVwZGF0ZURpcmVjdGl2ZSkudG9TdG10KCkpO1xuICB9XG5cbiAgY29uc3QgY29udGVudFF1ZXJpZXNGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fQ29udGVudFF1ZXJpZXNgIDogbnVsbDtcbiAgcmV0dXJuIG8uZm4oXG4gICAgICBbXG4gICAgICAgIG5ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpLFxuICAgICAgICBuZXcgby5GblBhcmFtKCdkaXJJbmRleCcsIG51bGwpXG4gICAgICBdLFxuICAgICAgW1xuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpLFxuICAgICAgICByZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5VcGRhdGUsIHVwZGF0ZVN0YXRlbWVudHMpXG4gICAgICBdLFxuICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBjb250ZW50UXVlcmllc0ZuTmFtZSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ0FzVHlwZShzdHI6IHN0cmluZyk6IG8uVHlwZSB7XG4gIHJldHVybiBvLmV4cHJlc3Npb25UeXBlKG8ubGl0ZXJhbChzdHIpKTtcbn1cblxuZnVuY3Rpb24gc3RyaW5nTWFwQXNUeXBlKG1hcDoge1trZXk6IHN0cmluZ106IHN0cmluZ3xzdHJpbmdbXX0pOiBvLlR5cGUge1xuICBjb25zdCBtYXBWYWx1ZXMgPSBPYmplY3Qua2V5cyhtYXApLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gQXJyYXkuaXNBcnJheShtYXBba2V5XSkgPyBtYXBba2V5XVswXSA6IG1hcFtrZXldO1xuICAgIHJldHVybiB7XG4gICAgICBrZXksXG4gICAgICB2YWx1ZTogby5saXRlcmFsKHZhbHVlKSxcbiAgICAgIHF1b3RlZDogdHJ1ZSxcbiAgICB9O1xuICB9KTtcbiAgcmV0dXJuIG8uZXhwcmVzc2lvblR5cGUoby5saXRlcmFsTWFwKG1hcFZhbHVlcykpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdBcnJheUFzVHlwZShhcnI6IFJlYWRvbmx5QXJyYXk8c3RyaW5nfG51bGw+KTogby5UeXBlIHtcbiAgcmV0dXJuIGFyci5sZW5ndGggPiAwID8gby5leHByZXNzaW9uVHlwZShvLmxpdGVyYWxBcnIoYXJyLm1hcCh2YWx1ZSA9PiBvLmxpdGVyYWwodmFsdWUpKSkpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgby5OT05FX1RZUEU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVEaXJlY3RpdmVUeXBlUGFyYW1zKG1ldGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEpOiBvLlR5cGVbXSB7XG4gIC8vIE9uIHRoZSB0eXBlIHNpZGUsIHJlbW92ZSBuZXdsaW5lcyBmcm9tIHRoZSBzZWxlY3RvciBhcyBpdCB3aWxsIG5lZWQgdG8gZml0IGludG8gYSBUeXBlU2NyaXB0XG4gIC8vIHN0cmluZyBsaXRlcmFsLCB3aGljaCBtdXN0IGJlIG9uIG9uZSBsaW5lLlxuICBjb25zdCBzZWxlY3RvckZvclR5cGUgPSBtZXRhLnNlbGVjdG9yICE9PSBudWxsID8gbWV0YS5zZWxlY3Rvci5yZXBsYWNlKC9cXG4vZywgJycpIDogbnVsbDtcblxuICByZXR1cm4gW1xuICAgIHR5cGVXaXRoUGFyYW1ldGVycyhtZXRhLnR5cGUudHlwZSwgbWV0YS50eXBlQXJndW1lbnRDb3VudCksXG4gICAgc2VsZWN0b3JGb3JUeXBlICE9PSBudWxsID8gc3RyaW5nQXNUeXBlKHNlbGVjdG9yRm9yVHlwZSkgOiBvLk5PTkVfVFlQRSxcbiAgICBtZXRhLmV4cG9ydEFzICE9PSBudWxsID8gc3RyaW5nQXJyYXlBc1R5cGUobWV0YS5leHBvcnRBcykgOiBvLk5PTkVfVFlQRSxcbiAgICBzdHJpbmdNYXBBc1R5cGUobWV0YS5pbnB1dHMpLFxuICAgIHN0cmluZ01hcEFzVHlwZShtZXRhLm91dHB1dHMpLFxuICAgIHN0cmluZ0FycmF5QXNUeXBlKG1ldGEucXVlcmllcy5tYXAocSA9PiBxLnByb3BlcnR5TmFtZSkpLFxuICBdO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgdGhlIHR5cGUgc3BlY2lmaWNhdGlvbiBmcm9tIHRoZSBkaXJlY3RpdmUgbWV0YS4gVGhpcyB0eXBlIGlzIGluc2VydGVkIGludG8gLmQudHMgZmlsZXNcbiAqIHRvIGJlIGNvbnN1bWVkIGJ5IHVwc3RyZWFtIGNvbXBpbGF0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZURpcmVjdGl2ZVR5cGUobWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YSk6IG8uVHlwZSB7XG4gIGNvbnN0IHR5cGVQYXJhbXMgPSBjcmVhdGVEaXJlY3RpdmVUeXBlUGFyYW1zKG1ldGEpO1xuICByZXR1cm4gby5leHByZXNzaW9uVHlwZShvLmltcG9ydEV4cHIoUjMuRGlyZWN0aXZlRGVjbGFyYXRpb24sIHR5cGVQYXJhbXMpKTtcbn1cblxuLy8gRGVmaW5lIGFuZCB1cGRhdGUgYW55IHZpZXcgcXVlcmllc1xuZnVuY3Rpb24gY3JlYXRlVmlld1F1ZXJpZXNGdW5jdGlvbihcbiAgICB2aWV3UXVlcmllczogUjNRdWVyeU1ldGFkYXRhW10sIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBuYW1lPzogc3RyaW5nKTogby5FeHByZXNzaW9uIHtcbiAgY29uc3QgY3JlYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCB1cGRhdGVTdGF0ZW1lbnRzOiBvLlN0YXRlbWVudFtdID0gW107XG4gIGNvbnN0IHRlbXBBbGxvY2F0b3IgPSB0ZW1wb3JhcnlBbGxvY2F0b3IodXBkYXRlU3RhdGVtZW50cywgVEVNUE9SQVJZX05BTUUpO1xuXG4gIHZpZXdRdWVyaWVzLmZvckVhY2goKHF1ZXJ5OiBSM1F1ZXJ5TWV0YWRhdGEpID0+IHtcbiAgICAvLyBjcmVhdGlvbiwgZS5nLiByMy52aWV3UXVlcnkoc29tZVByZWRpY2F0ZSwgdHJ1ZSk7XG4gICAgY29uc3QgcXVlcnlEZWZpbml0aW9uID1cbiAgICAgICAgby5pbXBvcnRFeHByKFIzLnZpZXdRdWVyeSkuY2FsbEZuKHByZXBhcmVRdWVyeVBhcmFtcyhxdWVyeSwgY29uc3RhbnRQb29sKSk7XG4gICAgY3JlYXRlU3RhdGVtZW50cy5wdXNoKHF1ZXJ5RGVmaW5pdGlvbi50b1N0bXQoKSk7XG5cbiAgICAvLyB1cGRhdGUsIGUuZy4gKHIzLnF1ZXJ5UmVmcmVzaCh0bXAgPSByMy5sb2FkUXVlcnkoKSkgJiYgKGN0eC5zb21lRGlyID0gdG1wKSk7XG4gICAgY29uc3QgdGVtcG9yYXJ5ID0gdGVtcEFsbG9jYXRvcigpO1xuICAgIGNvbnN0IGdldFF1ZXJ5TGlzdCA9IG8uaW1wb3J0RXhwcihSMy5sb2FkUXVlcnkpLmNhbGxGbihbXSk7XG4gICAgY29uc3QgcmVmcmVzaCA9IG8uaW1wb3J0RXhwcihSMy5xdWVyeVJlZnJlc2gpLmNhbGxGbihbdGVtcG9yYXJ5LnNldChnZXRRdWVyeUxpc3QpXSk7XG4gICAgY29uc3QgdXBkYXRlRGlyZWN0aXZlID0gby52YXJpYWJsZShDT05URVhUX05BTUUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wcm9wKHF1ZXJ5LnByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldChxdWVyeS5maXJzdCA/IHRlbXBvcmFyeS5wcm9wKCdmaXJzdCcpIDogdGVtcG9yYXJ5KTtcbiAgICB1cGRhdGVTdGF0ZW1lbnRzLnB1c2gocmVmcmVzaC5hbmQodXBkYXRlRGlyZWN0aXZlKS50b1N0bXQoKSk7XG4gIH0pO1xuXG4gIGNvbnN0IHZpZXdRdWVyeUZuTmFtZSA9IG5hbWUgPyBgJHtuYW1lfV9RdWVyeWAgOiBudWxsO1xuICByZXR1cm4gby5mbihcbiAgICAgIFtuZXcgby5GblBhcmFtKFJFTkRFUl9GTEFHUywgby5OVU1CRVJfVFlQRSksIG5ldyBvLkZuUGFyYW0oQ09OVEVYVF9OQU1FLCBudWxsKV0sXG4gICAgICBbXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLkNyZWF0ZSwgY3JlYXRlU3RhdGVtZW50cyksXG4gICAgICAgIHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cylcbiAgICAgIF0sXG4gICAgICBvLklORkVSUkVEX1RZUEUsIG51bGwsIHZpZXdRdWVyeUZuTmFtZSk7XG59XG5cbi8vIFJldHVybiBhIGhvc3QgYmluZGluZyBmdW5jdGlvbiBvciBudWxsIGlmIG9uZSBpcyBub3QgbmVjZXNzYXJ5LlxuZnVuY3Rpb24gY3JlYXRlSG9zdEJpbmRpbmdzRnVuY3Rpb24oXG4gICAgaG9zdEJpbmRpbmdzTWV0YWRhdGE6IFIzSG9zdE1ldGFkYXRhLCB0eXBlU291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIsIGNvbnN0YW50UG9vbDogQ29uc3RhbnRQb29sLCBzZWxlY3Rvcjogc3RyaW5nLCBuYW1lOiBzdHJpbmcsXG4gICAgZGVmaW5pdGlvbk1hcDogRGVmaW5pdGlvbk1hcCk6IG8uRXhwcmVzc2lvbnxudWxsIHtcbiAgY29uc3QgYmluZGluZ0NvbnRleHQgPSBvLnZhcmlhYmxlKENPTlRFWFRfTkFNRSk7XG4gIGNvbnN0IHN0eWxlQnVpbGRlciA9IG5ldyBTdHlsaW5nQnVpbGRlcihiaW5kaW5nQ29udGV4dCk7XG5cbiAgY29uc3Qge3N0eWxlQXR0ciwgY2xhc3NBdHRyfSA9IGhvc3RCaW5kaW5nc01ldGFkYXRhLnNwZWNpYWxBdHRyaWJ1dGVzO1xuICBpZiAoc3R5bGVBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJTdHlsZUF0dHIoc3R5bGVBdHRyKTtcbiAgfVxuICBpZiAoY2xhc3NBdHRyICE9PSB1bmRlZmluZWQpIHtcbiAgICBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJDbGFzc0F0dHIoY2xhc3NBdHRyKTtcbiAgfVxuXG4gIGNvbnN0IGNyZWF0ZVN0YXRlbWVudHM6IG8uU3RhdGVtZW50W10gPSBbXTtcbiAgY29uc3QgdXBkYXRlU3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIGNvbnN0IGhvc3RCaW5kaW5nU291cmNlU3BhbiA9IHR5cGVTb3VyY2VTcGFuO1xuICBjb25zdCBkaXJlY3RpdmVTdW1tYXJ5ID0gbWV0YWRhdGFBc1N1bW1hcnkoaG9zdEJpbmRpbmdzTWV0YWRhdGEpO1xuXG4gIC8vIENhbGN1bGF0ZSBob3N0IGV2ZW50IGJpbmRpbmdzXG4gIGNvbnN0IGV2ZW50QmluZGluZ3MgPVxuICAgICAgYmluZGluZ1BhcnNlci5jcmVhdGVEaXJlY3RpdmVIb3N0RXZlbnRBc3RzKGRpcmVjdGl2ZVN1bW1hcnksIGhvc3RCaW5kaW5nU291cmNlU3Bhbik7XG4gIGlmIChldmVudEJpbmRpbmdzICYmIGV2ZW50QmluZGluZ3MubGVuZ3RoKSB7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gY3JlYXRlSG9zdExpc3RlbmVycyhldmVudEJpbmRpbmdzLCBuYW1lKTtcbiAgICBjcmVhdGVTdGF0ZW1lbnRzLnB1c2goLi4ubGlzdGVuZXJzKTtcbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSB0aGUgaG9zdCBwcm9wZXJ0eSBiaW5kaW5nc1xuICBjb25zdCBiaW5kaW5ncyA9IGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhkaXJlY3RpdmVTdW1tYXJ5LCBob3N0QmluZGluZ1NvdXJjZVNwYW4pO1xuICBjb25zdCBhbGxPdGhlckJpbmRpbmdzOiBQYXJzZWRQcm9wZXJ0eVtdID0gW107XG5cbiAgLy8gV2UgbmVlZCB0byBjYWxjdWxhdGUgdGhlIHRvdGFsIGFtb3VudCBvZiBiaW5kaW5nIHNsb3RzIHJlcXVpcmVkIGJ5XG4gIC8vIGFsbCB0aGUgaW5zdHJ1Y3Rpb25zIHRvZ2V0aGVyIGJlZm9yZSBhbnkgdmFsdWUgY29udmVyc2lvbnMgaGFwcGVuLlxuICAvLyBWYWx1ZSBjb252ZXJzaW9ucyBtYXkgcmVxdWlyZSBhZGRpdGlvbmFsIHNsb3RzIGZvciBpbnRlcnBvbGF0aW9uIGFuZFxuICAvLyBiaW5kaW5ncyB3aXRoIHBpcGVzLiBUaGVzZSBjYWxjdWxhdGVzIGhhcHBlbiBhZnRlciB0aGlzIGJsb2NrLlxuICBsZXQgdG90YWxIb3N0VmFyc0NvdW50ID0gMDtcbiAgYmluZGluZ3MgJiYgYmluZGluZ3MuZm9yRWFjaCgoYmluZGluZzogUGFyc2VkUHJvcGVydHkpID0+IHtcbiAgICBjb25zdCBzdHlsaW5nSW5wdXRXYXNTZXQgPSBzdHlsZUJ1aWxkZXIucmVnaXN0ZXJJbnB1dEJhc2VkT25OYW1lKFxuICAgICAgICBiaW5kaW5nLm5hbWUsIGJpbmRpbmcuZXhwcmVzc2lvbiwgaG9zdEJpbmRpbmdTb3VyY2VTcGFuKTtcbiAgICBpZiAoc3R5bGluZ0lucHV0V2FzU2V0KSB7XG4gICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz0gTUlOX1NUWUxJTkdfQklORElOR19TTE9UU19SRVFVSVJFRDtcbiAgICB9IGVsc2Uge1xuICAgICAgYWxsT3RoZXJCaW5kaW5ncy5wdXNoKGJpbmRpbmcpO1xuICAgICAgdG90YWxIb3N0VmFyc0NvdW50Kys7XG4gICAgfVxuICB9KTtcblxuICBsZXQgdmFsdWVDb252ZXJ0ZXI6IFZhbHVlQ29udmVydGVyO1xuICBjb25zdCBnZXRWYWx1ZUNvbnZlcnRlciA9ICgpID0+IHtcbiAgICBpZiAoIXZhbHVlQ29udmVydGVyKSB7XG4gICAgICBjb25zdCBob3N0VmFyc0NvdW50Rm4gPSAobnVtU2xvdHM6IG51bWJlcik6IG51bWJlciA9PiB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsVmFyc0NvdW50ID0gdG90YWxIb3N0VmFyc0NvdW50O1xuICAgICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz0gbnVtU2xvdHM7XG4gICAgICAgIHJldHVybiBvcmlnaW5hbFZhcnNDb3VudDtcbiAgICAgIH07XG4gICAgICB2YWx1ZUNvbnZlcnRlciA9IG5ldyBWYWx1ZUNvbnZlcnRlcihcbiAgICAgICAgICBjb25zdGFudFBvb2wsXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgbm9kZScpLCAgLy8gbmV3IG5vZGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICAgICAgICBob3N0VmFyc0NvdW50Rm4sXG4gICAgICAgICAgKCkgPT4gZXJyb3IoJ1VuZXhwZWN0ZWQgcGlwZScpKTsgIC8vIHBpcGVzIGFyZSBpbGxlZ2FsIGhlcmVcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlQ29udmVydGVyO1xuICB9O1xuXG4gIGNvbnN0IHByb3BlcnR5QmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3QgYXR0cmlidXRlQmluZGluZ3M6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3Qgc3ludGhldGljSG9zdEJpbmRpbmdzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGFsbE90aGVyQmluZGluZ3MuZm9yRWFjaCgoYmluZGluZzogUGFyc2VkUHJvcGVydHkpID0+IHtcbiAgICAvLyByZXNvbHZlIGxpdGVyYWwgYXJyYXlzIGFuZCBsaXRlcmFsIG9iamVjdHNcbiAgICBjb25zdCB2YWx1ZSA9IGJpbmRpbmcuZXhwcmVzc2lvbi52aXNpdChnZXRWYWx1ZUNvbnZlcnRlcigpKTtcbiAgICBjb25zdCBiaW5kaW5nRXhwciA9IGJpbmRpbmdGbihiaW5kaW5nQ29udGV4dCwgdmFsdWUpO1xuXG4gICAgY29uc3Qge2JpbmRpbmdOYW1lLCBpbnN0cnVjdGlvbiwgaXNBdHRyaWJ1dGV9ID0gZ2V0QmluZGluZ05hbWVBbmRJbnN0cnVjdGlvbihiaW5kaW5nKTtcblxuICAgIGNvbnN0IHNlY3VyaXR5Q29udGV4dHMgPVxuICAgICAgICBiaW5kaW5nUGFyc2VyLmNhbGNQb3NzaWJsZVNlY3VyaXR5Q29udGV4dHMoc2VsZWN0b3IsIGJpbmRpbmdOYW1lLCBpc0F0dHJpYnV0ZSlcbiAgICAgICAgICAgIC5maWx0ZXIoY29udGV4dCA9PiBjb250ZXh0ICE9PSBjb3JlLlNlY3VyaXR5Q29udGV4dC5OT05FKTtcblxuICAgIGxldCBzYW5pdGl6ZXJGbjogby5FeHRlcm5hbEV4cHJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKHNlY3VyaXR5Q29udGV4dHMubGVuZ3RoKSB7XG4gICAgICBpZiAoc2VjdXJpdHlDb250ZXh0cy5sZW5ndGggPT09IDIgJiZcbiAgICAgICAgICBzZWN1cml0eUNvbnRleHRzLmluZGV4T2YoY29yZS5TZWN1cml0eUNvbnRleHQuVVJMKSA+IC0xICYmXG4gICAgICAgICAgc2VjdXJpdHlDb250ZXh0cy5pbmRleE9mKGNvcmUuU2VjdXJpdHlDb250ZXh0LlJFU09VUkNFX1VSTCkgPiAtMSkge1xuICAgICAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIHNvbWUgVVJMIGF0dHJpYnV0ZXMgKHN1Y2ggYXMgXCJzcmNcIiBhbmQgXCJocmVmXCIpIHRoYXQgbWF5IGJlIGEgcGFydFxuICAgICAgICAvLyBvZiBkaWZmZXJlbnQgc2VjdXJpdHkgY29udGV4dHMuIEluIHRoaXMgY2FzZSB3ZSB1c2Ugc3BlY2lhbCBzYW5pdGl6YXRpb24gZnVuY3Rpb24gYW5kXG4gICAgICAgIC8vIHNlbGVjdCB0aGUgYWN0dWFsIHNhbml0aXplciBhdCBydW50aW1lIGJhc2VkIG9uIGEgdGFnIG5hbWUgdGhhdCBpcyBwcm92aWRlZCB3aGlsZVxuICAgICAgICAvLyBpbnZva2luZyBzYW5pdGl6YXRpb24gZnVuY3Rpb24uXG4gICAgICAgIHNhbml0aXplckZuID0gby5pbXBvcnRFeHByKFIzLnNhbml0aXplVXJsT3JSZXNvdXJjZVVybCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzYW5pdGl6ZXJGbiA9IHJlc29sdmVTYW5pdGl6YXRpb25GbihzZWN1cml0eUNvbnRleHRzWzBdLCBpc0F0dHJpYnV0ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGluc3RydWN0aW9uUGFyYW1zID0gW28ubGl0ZXJhbChiaW5kaW5nTmFtZSksIGJpbmRpbmdFeHByLmN1cnJWYWxFeHByXTtcbiAgICBpZiAoc2FuaXRpemVyRm4pIHtcbiAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goc2FuaXRpemVyRm4pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiB0aGVyZSB3YXMgbm8gc2FuaXRpemF0aW9uIGZ1bmN0aW9uIGZvdW5kIGJhc2VkIG9uIHRoZSBzZWN1cml0eSBjb250ZXh0XG4gICAgICAvLyBvZiBhbiBhdHRyaWJ1dGUvcHJvcGVydHkgYmluZGluZyAtIGNoZWNrIHdoZXRoZXIgdGhpcyBhdHRyaWJ1dGUvcHJvcGVydHkgaXNcbiAgICAgIC8vIG9uZSBvZiB0aGUgc2VjdXJpdHktc2Vuc2l0aXZlIDxpZnJhbWU+IGF0dHJpYnV0ZXMuXG4gICAgICAvLyBOb3RlOiBmb3IgaG9zdCBiaW5kaW5ncyBkZWZpbmVkIG9uIGEgZGlyZWN0aXZlLCB3ZSBkbyBub3QgdHJ5IHRvIGZpbmQgYWxsXG4gICAgICAvLyBwb3NzaWJsZSBwbGFjZXMgd2hlcmUgaXQgY2FuIGJlIG1hdGNoZWQsIHNvIHdlIGNhbiBub3QgZGV0ZXJtaW5lIHdoZXRoZXJcbiAgICAgIC8vIHRoZSBob3N0IGVsZW1lbnQgaXMgYW4gPGlmcmFtZT4uIEluIHRoaXMgY2FzZSwgaWYgYW4gYXR0cmlidXRlL2JpbmRpbmdcbiAgICAgIC8vIG5hbWUgaXMgaW4gdGhlIGBJRlJBTUVfU0VDVVJJVFlfU0VOU0lUSVZFX0FUVFJTYCBzZXQgLSBhcHBlbmQgYSB2YWxpZGF0aW9uXG4gICAgICAvLyBmdW5jdGlvbiwgd2hpY2ggd291bGQgYmUgaW52b2tlZCBhdCBydW50aW1lIGFuZCB3b3VsZCBoYXZlIGFjY2VzcyB0byB0aGVcbiAgICAgIC8vIHVuZGVybHlpbmcgRE9NIGVsZW1lbnQsIGNoZWNrIGlmIGl0J3MgYW4gPGlmcmFtZT4gYW5kIGlmIHNvIC0gcnVucyBleHRyYSBjaGVja3MuXG4gICAgICBpZiAoaXNJZnJhbWVTZWN1cml0eVNlbnNpdGl2ZUF0dHIoYmluZGluZ05hbWUpKSB7XG4gICAgICAgIGluc3RydWN0aW9uUGFyYW1zLnB1c2goby5pbXBvcnRFeHByKFIzLnZhbGlkYXRlSWZyYW1lQXR0cmlidXRlKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKC4uLmJpbmRpbmdFeHByLnN0bXRzKTtcblxuICAgIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuaG9zdFByb3BlcnR5KSB7XG4gICAgICBwcm9wZXJ0eUJpbmRpbmdzLnB1c2goaW5zdHJ1Y3Rpb25QYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAoaW5zdHJ1Y3Rpb24gPT09IFIzLmF0dHJpYnV0ZSkge1xuICAgICAgYXR0cmlidXRlQmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIGlmIChpbnN0cnVjdGlvbiA9PT0gUjMuc3ludGhldGljSG9zdFByb3BlcnR5KSB7XG4gICAgICBzeW50aGV0aWNIb3N0QmluZGluZ3MucHVzaChpbnN0cnVjdGlvblBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChvLmltcG9ydEV4cHIoaW5zdHJ1Y3Rpb24pLmNhbGxGbihpbnN0cnVjdGlvblBhcmFtcykudG9TdG10KCkpO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKHByb3BlcnR5QmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChjaGFpbmVkSW5zdHJ1Y3Rpb24oUjMuaG9zdFByb3BlcnR5LCBwcm9wZXJ0eUJpbmRpbmdzKS50b1N0bXQoKSk7XG4gIH1cblxuICBpZiAoYXR0cmlidXRlQmluZGluZ3MubGVuZ3RoID4gMCkge1xuICAgIHVwZGF0ZVN0YXRlbWVudHMucHVzaChjaGFpbmVkSW5zdHJ1Y3Rpb24oUjMuYXR0cmlidXRlLCBhdHRyaWJ1dGVCaW5kaW5ncykudG9TdG10KCkpO1xuICB9XG5cbiAgaWYgKHN5bnRoZXRpY0hvc3RCaW5kaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKFxuICAgICAgICBjaGFpbmVkSW5zdHJ1Y3Rpb24oUjMuc3ludGhldGljSG9zdFByb3BlcnR5LCBzeW50aGV0aWNIb3N0QmluZGluZ3MpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIC8vIHNpbmNlIHdlJ3JlIGRlYWxpbmcgd2l0aCBkaXJlY3RpdmVzL2NvbXBvbmVudHMgYW5kIGJvdGggaGF2ZSBob3N0QmluZGluZ1xuICAvLyBmdW5jdGlvbnMsIHdlIG5lZWQgdG8gZ2VuZXJhdGUgYSBzcGVjaWFsIGhvc3RBdHRycyBpbnN0cnVjdGlvbiB0aGF0IGRlYWxzXG4gIC8vIHdpdGggYm90aCB0aGUgYXNzaWdubWVudCBvZiBzdHlsaW5nIGFzIHdlbGwgYXMgc3RhdGljIGF0dHJpYnV0ZXMgdG8gdGhlIGhvc3RcbiAgLy8gZWxlbWVudC4gVGhlIGluc3RydWN0aW9uIGJlbG93IHdpbGwgaW5zdHJ1Y3QgYWxsIGluaXRpYWwgc3R5bGluZyAoc3R5bGluZ1xuICAvLyB0aGF0IGlzIGluc2lkZSBvZiBhIGhvc3QgYmluZGluZyB3aXRoaW4gYSBkaXJlY3RpdmUvY29tcG9uZW50KSB0byBiZSBhdHRhY2hlZFxuICAvLyB0byB0aGUgaG9zdCBlbGVtZW50IGFsb25nc2lkZSBhbnkgb2YgdGhlIHByb3ZpZGVkIGhvc3QgYXR0cmlidXRlcyB0aGF0IHdlcmVcbiAgLy8gY29sbGVjdGVkIGVhcmxpZXIuXG4gIGNvbnN0IGhvc3RBdHRycyA9IGNvbnZlcnRBdHRyaWJ1dGVzVG9FeHByZXNzaW9ucyhob3N0QmluZGluZ3NNZXRhZGF0YS5hdHRyaWJ1dGVzKTtcbiAgc3R5bGVCdWlsZGVyLmFzc2lnbkhvc3RBdHRycyhob3N0QXR0cnMsIGRlZmluaXRpb25NYXApO1xuXG4gIGlmIChzdHlsZUJ1aWxkZXIuaGFzQmluZGluZ3MpIHtcbiAgICAvLyBmaW5hbGx5IGVhY2ggYmluZGluZyB0aGF0IHdhcyByZWdpc3RlcmVkIGluIHRoZSBzdGF0ZW1lbnQgYWJvdmUgd2lsbCBuZWVkIHRvIGJlIGFkZGVkIHRvXG4gICAgLy8gdGhlIHVwZGF0ZSBibG9jayBvZiBhIGNvbXBvbmVudC9kaXJlY3RpdmUgdGVtcGxhdGVGbi9ob3N0QmluZGluZ3NGbiBzbyB0aGF0IHRoZSBiaW5kaW5nc1xuICAgIC8vIGFyZSBldmFsdWF0ZWQgYW5kIHVwZGF0ZWQgZm9yIHRoZSBlbGVtZW50LlxuICAgIHN0eWxlQnVpbGRlci5idWlsZFVwZGF0ZUxldmVsSW5zdHJ1Y3Rpb25zKGdldFZhbHVlQ29udmVydGVyKCkpLmZvckVhY2goaW5zdHJ1Y3Rpb24gPT4ge1xuICAgICAgaWYgKGluc3RydWN0aW9uLmNhbGxzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgY2FsbHM6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcblxuICAgICAgICBpbnN0cnVjdGlvbi5jYWxscy5mb3JFYWNoKGNhbGwgPT4ge1xuICAgICAgICAgIC8vIHdlIHN1YnRyYWN0IGEgdmFsdWUgb2YgYDFgIGhlcmUgYmVjYXVzZSB0aGUgYmluZGluZyBzbG90IHdhcyBhbHJlYWR5IGFsbG9jYXRlZFxuICAgICAgICAgIC8vIGF0IHRoZSB0b3Agb2YgdGhpcyBtZXRob2Qgd2hlbiBhbGwgdGhlIGlucHV0IGJpbmRpbmdzIHdlcmUgY291bnRlZC5cbiAgICAgICAgICB0b3RhbEhvc3RWYXJzQ291bnQgKz1cbiAgICAgICAgICAgICAgTWF0aC5tYXgoY2FsbC5hbGxvY2F0ZUJpbmRpbmdTbG90cyAtIE1JTl9TVFlMSU5HX0JJTkRJTkdfU0xPVFNfUkVRVUlSRUQsIDApO1xuICAgICAgICAgIGNhbGxzLnB1c2goY29udmVydFN0eWxpbmdDYWxsKGNhbGwsIGJpbmRpbmdDb250ZXh0LCBiaW5kaW5nRm4pKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdXBkYXRlU3RhdGVtZW50cy5wdXNoKGNoYWluZWRJbnN0cnVjdGlvbihpbnN0cnVjdGlvbi5yZWZlcmVuY2UsIGNhbGxzKS50b1N0bXQoKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBpZiAodG90YWxIb3N0VmFyc0NvdW50KSB7XG4gICAgZGVmaW5pdGlvbk1hcC5zZXQoJ2hvc3RWYXJzJywgby5saXRlcmFsKHRvdGFsSG9zdFZhcnNDb3VudCkpO1xuICB9XG5cbiAgaWYgKGNyZWF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCB8fCB1cGRhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBob3N0QmluZGluZ3NGbk5hbWUgPSBuYW1lID8gYCR7bmFtZX1fSG9zdEJpbmRpbmdzYCA6IG51bGw7XG4gICAgY29uc3Qgc3RhdGVtZW50czogby5TdGF0ZW1lbnRbXSA9IFtdO1xuICAgIGlmIChjcmVhdGVTdGF0ZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHN0YXRlbWVudHMucHVzaChyZW5kZXJGbGFnQ2hlY2tJZlN0bXQoY29yZS5SZW5kZXJGbGFncy5DcmVhdGUsIGNyZWF0ZVN0YXRlbWVudHMpKTtcbiAgICB9XG4gICAgaWYgKHVwZGF0ZVN0YXRlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgc3RhdGVtZW50cy5wdXNoKHJlbmRlckZsYWdDaGVja0lmU3RtdChjb3JlLlJlbmRlckZsYWdzLlVwZGF0ZSwgdXBkYXRlU3RhdGVtZW50cykpO1xuICAgIH1cbiAgICByZXR1cm4gby5mbihcbiAgICAgICAgW25ldyBvLkZuUGFyYW0oUkVOREVSX0ZMQUdTLCBvLk5VTUJFUl9UWVBFKSwgbmV3IG8uRm5QYXJhbShDT05URVhUX05BTUUsIG51bGwpXSwgc3RhdGVtZW50cyxcbiAgICAgICAgby5JTkZFUlJFRF9UWVBFLCBudWxsLCBob3N0QmluZGluZ3NGbk5hbWUpO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGJpbmRpbmdGbihpbXBsaWNpdDogYW55LCB2YWx1ZTogQVNUKSB7XG4gIHJldHVybiBjb252ZXJ0UHJvcGVydHlCaW5kaW5nKFxuICAgICAgbnVsbCwgaW1wbGljaXQsIHZhbHVlLCAnYicsIEJpbmRpbmdGb3JtLkV4cHJlc3Npb24sICgpID0+IGVycm9yKCdVbmV4cGVjdGVkIGludGVycG9sYXRpb24nKSk7XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRTdHlsaW5nQ2FsbChcbiAgICBjYWxsOiBTdHlsaW5nSW5zdHJ1Y3Rpb25DYWxsLCBiaW5kaW5nQ29udGV4dDogYW55LCBiaW5kaW5nRm46IEZ1bmN0aW9uKSB7XG4gIHJldHVybiBjYWxsLnBhcmFtcyh2YWx1ZSA9PiBiaW5kaW5nRm4oYmluZGluZ0NvbnRleHQsIHZhbHVlKS5jdXJyVmFsRXhwcik7XG59XG5cbmZ1bmN0aW9uIGdldEJpbmRpbmdOYW1lQW5kSW5zdHJ1Y3Rpb24oYmluZGluZzogUGFyc2VkUHJvcGVydHkpOlxuICAgIHtiaW5kaW5nTmFtZTogc3RyaW5nLCBpbnN0cnVjdGlvbjogby5FeHRlcm5hbFJlZmVyZW5jZSwgaXNBdHRyaWJ1dGU6IGJvb2xlYW59IHtcbiAgbGV0IGJpbmRpbmdOYW1lID0gYmluZGluZy5uYW1lO1xuICBsZXQgaW5zdHJ1Y3Rpb24hOiBvLkV4dGVybmFsUmVmZXJlbmNlO1xuXG4gIC8vIENoZWNrIHRvIHNlZSBpZiB0aGlzIGlzIGFuIGF0dHIgYmluZGluZyBvciBhIHByb3BlcnR5IGJpbmRpbmdcbiAgY29uc3QgYXR0ck1hdGNoZXMgPSBiaW5kaW5nTmFtZS5tYXRjaChBVFRSX1JFR0VYKTtcbiAgaWYgKGF0dHJNYXRjaGVzKSB7XG4gICAgYmluZGluZ05hbWUgPSBhdHRyTWF0Y2hlc1sxXTtcbiAgICBpbnN0cnVjdGlvbiA9IFIzLmF0dHJpYnV0ZTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoYmluZGluZy5pc0FuaW1hdGlvbikge1xuICAgICAgYmluZGluZ05hbWUgPSBwcmVwYXJlU3ludGhldGljUHJvcGVydHlOYW1lKGJpbmRpbmdOYW1lKTtcbiAgICAgIC8vIGhvc3QgYmluZGluZ3MgdGhhdCBoYXZlIGEgc3ludGhldGljIHByb3BlcnR5IChlLmcuIEBmb28pIHNob3VsZCBhbHdheXMgYmUgcmVuZGVyZWRcbiAgICAgIC8vIGluIHRoZSBjb250ZXh0IG9mIHRoZSBjb21wb25lbnQgYW5kIG5vdCB0aGUgcGFyZW50LiBUaGVyZWZvcmUgdGhlcmUgaXMgYSBzcGVjaWFsXG4gICAgICAvLyBjb21wYXRpYmlsaXR5IGluc3RydWN0aW9uIGF2YWlsYWJsZSBmb3IgdGhpcyBwdXJwb3NlLlxuICAgICAgaW5zdHJ1Y3Rpb24gPSBSMy5zeW50aGV0aWNIb3N0UHJvcGVydHk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluc3RydWN0aW9uID0gUjMuaG9zdFByb3BlcnR5O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7YmluZGluZ05hbWUsIGluc3RydWN0aW9uLCBpc0F0dHJpYnV0ZTogISFhdHRyTWF0Y2hlc307XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUhvc3RMaXN0ZW5lcnMoZXZlbnRCaW5kaW5nczogUGFyc2VkRXZlbnRbXSwgbmFtZT86IHN0cmluZyk6IG8uU3RhdGVtZW50W10ge1xuICBjb25zdCBsaXN0ZW5lcnM6IG8uRXhwcmVzc2lvbltdW10gPSBbXTtcbiAgY29uc3Qgc3ludGhldGljTGlzdGVuZXJzOiBvLkV4cHJlc3Npb25bXVtdID0gW107XG4gIGNvbnN0IGluc3RydWN0aW9uczogby5TdGF0ZW1lbnRbXSA9IFtdO1xuXG4gIGV2ZW50QmluZGluZ3MuZm9yRWFjaChiaW5kaW5nID0+IHtcbiAgICBsZXQgYmluZGluZ05hbWUgPSBiaW5kaW5nLm5hbWUgJiYgc2FuaXRpemVJZGVudGlmaWVyKGJpbmRpbmcubmFtZSk7XG4gICAgY29uc3QgYmluZGluZ0ZuTmFtZSA9IGJpbmRpbmcudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbiA/XG4gICAgICAgIHByZXBhcmVTeW50aGV0aWNMaXN0ZW5lckZ1bmN0aW9uTmFtZShiaW5kaW5nTmFtZSwgYmluZGluZy50YXJnZXRPclBoYXNlKSA6XG4gICAgICAgIGJpbmRpbmdOYW1lO1xuICAgIGNvbnN0IGhhbmRsZXJOYW1lID0gbmFtZSAmJiBiaW5kaW5nTmFtZSA/IGAke25hbWV9XyR7YmluZGluZ0ZuTmFtZX1fSG9zdEJpbmRpbmdIYW5kbGVyYCA6IG51bGw7XG4gICAgY29uc3QgcGFyYW1zID0gcHJlcGFyZUV2ZW50TGlzdGVuZXJQYXJhbWV0ZXJzKEJvdW5kRXZlbnQuZnJvbVBhcnNlZEV2ZW50KGJpbmRpbmcpLCBoYW5kbGVyTmFtZSk7XG5cbiAgICBpZiAoYmluZGluZy50eXBlID09IFBhcnNlZEV2ZW50VHlwZS5BbmltYXRpb24pIHtcbiAgICAgIHN5bnRoZXRpY0xpc3RlbmVycy5wdXNoKHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3RlbmVycy5wdXNoKHBhcmFtcyk7XG4gICAgfVxuICB9KTtcblxuICBpZiAoc3ludGhldGljTGlzdGVuZXJzLmxlbmd0aCA+IDApIHtcbiAgICBpbnN0cnVjdGlvbnMucHVzaChjaGFpbmVkSW5zdHJ1Y3Rpb24oUjMuc3ludGhldGljSG9zdExpc3RlbmVyLCBzeW50aGV0aWNMaXN0ZW5lcnMpLnRvU3RtdCgpKTtcbiAgfVxuXG4gIGlmIChsaXN0ZW5lcnMubGVuZ3RoID4gMCkge1xuICAgIGluc3RydWN0aW9ucy5wdXNoKGNoYWluZWRJbnN0cnVjdGlvbihSMy5saXN0ZW5lciwgbGlzdGVuZXJzKS50b1N0bXQoKSk7XG4gIH1cblxuICByZXR1cm4gaW5zdHJ1Y3Rpb25zO1xufVxuXG5mdW5jdGlvbiBtZXRhZGF0YUFzU3VtbWFyeShtZXRhOiBSM0hvc3RNZXRhZGF0YSk6IENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5IHtcbiAgLy8gY2xhbmctZm9ybWF0IG9mZlxuICByZXR1cm4ge1xuICAgIC8vIFRoaXMgaXMgdXNlZCBieSB0aGUgQmluZGluZ1BhcnNlciwgd2hpY2ggb25seSBkZWFscyB3aXRoIGxpc3RlbmVycyBhbmQgcHJvcGVydGllcy4gVGhlcmUncyBub1xuICAgIC8vIG5lZWQgdG8gcGFzcyBhdHRyaWJ1dGVzIHRvIGl0LlxuICAgIGhvc3RBdHRyaWJ1dGVzOiB7fSxcbiAgICBob3N0TGlzdGVuZXJzOiBtZXRhLmxpc3RlbmVycyxcbiAgICBob3N0UHJvcGVydGllczogbWV0YS5wcm9wZXJ0aWVzLFxuICB9IGFzIENvbXBpbGVEaXJlY3RpdmVTdW1tYXJ5O1xuICAvLyBjbGFuZy1mb3JtYXQgb25cbn1cblxuXG5cbmNvbnN0IEhPU1RfUkVHX0VYUCA9IC9eKD86XFxbKFteXFxdXSspXFxdKXwoPzpcXCgoW15cXCldKylcXCkpJC87XG4vLyBSZXByZXNlbnRzIHRoZSBncm91cHMgaW4gdGhlIGFib3ZlIHJlZ2V4LlxuY29uc3QgZW51bSBIb3N0QmluZGluZ0dyb3VwIHtcbiAgLy8gZ3JvdXAgMTogXCJwcm9wXCIgZnJvbSBcIltwcm9wXVwiLCBvciBcImF0dHIucm9sZVwiIGZyb20gXCJbYXR0ci5yb2xlXVwiLCBvciBAYW5pbSBmcm9tIFtAYW5pbV1cbiAgQmluZGluZyA9IDEsXG5cbiAgLy8gZ3JvdXAgMjogXCJldmVudFwiIGZyb20gXCIoZXZlbnQpXCJcbiAgRXZlbnQgPSAyLFxufVxuXG4vLyBEZWZpbmVzIEhvc3QgQmluZGluZ3Mgc3RydWN0dXJlIHRoYXQgY29udGFpbnMgYXR0cmlidXRlcywgbGlzdGVuZXJzLCBhbmQgcHJvcGVydGllcyxcbi8vIHBhcnNlZCBmcm9tIHRoZSBgaG9zdGAgb2JqZWN0IGRlZmluZWQgZm9yIGEgVHlwZS5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgYXR0cmlidXRlczoge1trZXk6IHN0cmluZ106IG8uRXhwcmVzc2lvbn07XG4gIGxpc3RlbmVyczoge1trZXk6IHN0cmluZ106IHN0cmluZ307XG4gIHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9O1xuICBzcGVjaWFsQXR0cmlidXRlczoge3N0eWxlQXR0cj86IHN0cmluZzsgY2xhc3NBdHRyPzogc3RyaW5nO307XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhvc3RCaW5kaW5ncyhob3N0OiB7W2tleTogc3RyaW5nXTogc3RyaW5nfG8uRXhwcmVzc2lvbn0pOiBQYXJzZWRIb3N0QmluZGluZ3Mge1xuICBjb25zdCBhdHRyaWJ1dGVzOiB7W2tleTogc3RyaW5nXTogby5FeHByZXNzaW9ufSA9IHt9O1xuICBjb25zdCBsaXN0ZW5lcnM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IHByb3BlcnRpZXM6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gIGNvbnN0IHNwZWNpYWxBdHRyaWJ1dGVzOiB7c3R5bGVBdHRyPzogc3RyaW5nOyBjbGFzc0F0dHI/OiBzdHJpbmc7fSA9IHt9O1xuXG4gIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGhvc3QpKSB7XG4gICAgY29uc3QgdmFsdWUgPSBob3N0W2tleV07XG4gICAgY29uc3QgbWF0Y2hlcyA9IGtleS5tYXRjaChIT1NUX1JFR19FWFApO1xuXG4gICAgaWYgKG1hdGNoZXMgPT09IG51bGwpIHtcbiAgICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICAgIGNhc2UgJ2NsYXNzJzpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgLy8gVE9ETyhhbHhodWIpOiBtYWtlIHRoaXMgYSBkaWFnbm9zdGljLlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDbGFzcyBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNwZWNpYWxBdHRyaWJ1dGVzLmNsYXNzQXR0ciA9IHZhbHVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdzdHlsZSc6XG4gICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU3R5bGUgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzcGVjaWFsQXR0cmlidXRlcy5zdHlsZUF0dHIgPSB2YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgYXR0cmlidXRlc1trZXldID0gby5saXRlcmFsKHZhbHVlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlc1trZXldID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddICE9IG51bGwpIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIFRPRE8oYWx4aHViKTogbWFrZSB0aGlzIGEgZGlhZ25vc3RpYy5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSBiaW5kaW5nIG11c3QgYmUgc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICAvLyBzeW50aGV0aWMgcHJvcGVydGllcyAodGhlIG9uZXMgdGhhdCBoYXZlIGEgYEBgIGFzIGEgcHJlZml4KVxuICAgICAgLy8gYXJlIHN0aWxsIHRyZWF0ZWQgdGhlIHNhbWUgYXMgcmVndWxhciBwcm9wZXJ0aWVzLiBUaGVyZWZvcmVcbiAgICAgIC8vIHRoZXJlIGlzIG5vIHBvaW50IGluIHN0b3JpbmcgdGhlbSBpbiBhIHNlcGFyYXRlIG1hcC5cbiAgICAgIHByb3BlcnRpZXNbbWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkJpbmRpbmddXSA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tIb3N0QmluZGluZ0dyb3VwLkV2ZW50XSAhPSBudWxsKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgICAvLyBUT0RPKGFseGh1Yik6IG1ha2UgdGhpcyBhIGRpYWdub3N0aWMuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXZlbnQgYmluZGluZyBtdXN0IGJlIHN0cmluZ2ApO1xuICAgICAgfVxuICAgICAgbGlzdGVuZXJzW21hdGNoZXNbSG9zdEJpbmRpbmdHcm91cC5FdmVudF1dID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHthdHRyaWJ1dGVzLCBsaXN0ZW5lcnMsIHByb3BlcnRpZXMsIHNwZWNpYWxBdHRyaWJ1dGVzfTtcbn1cblxuLyoqXG4gKiBWZXJpZmllcyBob3N0IGJpbmRpbmdzIGFuZCByZXR1cm5zIHRoZSBsaXN0IG9mIGVycm9ycyAoaWYgYW55KS4gRW1wdHkgYXJyYXkgaW5kaWNhdGVzIHRoYXQgYVxuICogZ2l2ZW4gc2V0IG9mIGhvc3QgYmluZGluZ3MgaGFzIG5vIGVycm9ycy5cbiAqXG4gKiBAcGFyYW0gYmluZGluZ3Mgc2V0IG9mIGhvc3QgYmluZGluZ3MgdG8gdmVyaWZ5LlxuICogQHBhcmFtIHNvdXJjZVNwYW4gc291cmNlIHNwYW4gd2hlcmUgaG9zdCBiaW5kaW5ncyB3ZXJlIGRlZmluZWQuXG4gKiBAcmV0dXJucyBhcnJheSBvZiBlcnJvcnMgYXNzb2NpYXRlZCB3aXRoIGEgZ2l2ZW4gc2V0IG9mIGhvc3QgYmluZGluZ3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2ZXJpZnlIb3N0QmluZGluZ3MoXG4gICAgYmluZGluZ3M6IFBhcnNlZEhvc3RCaW5kaW5ncywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuKTogUGFyc2VFcnJvcltdIHtcbiAgY29uc3Qgc3VtbWFyeSA9IG1ldGFkYXRhQXNTdW1tYXJ5KGJpbmRpbmdzKTtcbiAgLy8gVE9ETzogYWJzdHJhY3Qgb3V0IGhvc3QgYmluZGluZ3MgdmVyaWZpY2F0aW9uIGxvZ2ljIGFuZCB1c2UgaXQgaW5zdGVhZCBvZlxuICAvLyBjcmVhdGluZyBldmVudHMgYW5kIHByb3BlcnRpZXMgQVNUcyB0byBkZXRlY3QgZXJyb3JzIChGVy05OTYpXG4gIGNvbnN0IGJpbmRpbmdQYXJzZXIgPSBtYWtlQmluZGluZ1BhcnNlcigpO1xuICBiaW5kaW5nUGFyc2VyLmNyZWF0ZURpcmVjdGl2ZUhvc3RFdmVudEFzdHMoc3VtbWFyeSwgc291cmNlU3Bhbik7XG4gIGJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRIb3N0UHJvcGVydGllcyhzdW1tYXJ5LCBzb3VyY2VTcGFuKTtcbiAgcmV0dXJuIGJpbmRpbmdQYXJzZXIuZXJyb3JzO1xufVxuXG5mdW5jdGlvbiBjb21waWxlU3R5bGVzKHN0eWxlczogc3RyaW5nW10sIHNlbGVjdG9yOiBzdHJpbmcsIGhvc3RTZWxlY3Rvcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzaGFkb3dDc3MgPSBuZXcgU2hhZG93Q3NzKCk7XG4gIHJldHVybiBzdHlsZXMubWFwKHN0eWxlID0+IHtcbiAgICByZXR1cm4gc2hhZG93Q3NzIS5zaGltQ3NzVGV4dChzdHlsZSwgc2VsZWN0b3IsIGhvc3RTZWxlY3Rvcik7XG4gIH0pO1xufVxuIl19