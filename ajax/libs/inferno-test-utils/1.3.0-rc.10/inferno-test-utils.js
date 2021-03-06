
/*!
 * inferno-test-utils v1.3.0-rc.10
 * (c) 2017 Dominic Gannaway'
 * Released under the MIT License.
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('inferno'), require('inferno-create-element')) :
	typeof define === 'function' && define.amd ? define(['exports', 'inferno', 'inferno-create-element'], factory) :
	(factory((global['inferno-test-utils'] = global['inferno-test-utils'] || {}),global.Inferno,global.Inferno.createElement));
}(this, (function (exports,inferno,createElement) { 'use strict';

createElement = 'default' in createElement ? createElement['default'] : createElement;

var NO_OP = '$NO_OP';
var ERROR_MSG = 'a runtime error occured! Use Inferno in development environment to find the error.';
var isBrowser = typeof window !== 'undefined' && window.document;

// this is MUCH faster than .constructor === Array and instanceof Array
// in Node 7 and the later versions of V8, slower in older versions though
var isArray = Array.isArray;

function isStringOrNumber(obj) {
    var type = typeof obj;
    return type === 'string' || type === 'number';
}
function isNullOrUndef(obj) {
    return isUndefined(obj) || isNull(obj);
}
function isInvalid(obj) {
    return isNull(obj) || obj === false || isTrue(obj) || isUndefined(obj);
}
function isFunction(obj) {
    return typeof obj === 'function';
}

function isString(obj) {
    return typeof obj === 'string';
}
function isNumber(obj) {
    return typeof obj === 'number';
}
function isNull(obj) {
    return obj === null;
}
function isTrue(obj) {
    return obj === true;
}
function isUndefined(obj) {
    return obj === undefined;
}
function isObject(o) {
    return typeof o === 'object';
}
function throwError(message) {
    if (!message) {
        message = ERROR_MSG;
    }
    throw new Error(("Inferno Error: " + message));
}

function assign(target) {
    var arguments$1 = arguments;

    for (var i = 1, argumentsLength = arguments.length; i < argumentsLength; i++) {
        var obj = arguments$1[i];
        if (!isNullOrUndef(obj)) {
            var keys = Object.keys(obj);
            for (var j = 0, keysLength = keys.length; j < keysLength; j++) {
                var key = keys[j];
                target[key] = obj[key];
            }
        }
    }
    return target;
}
function Lifecycle() {
    this.listeners = [];
}
Lifecycle.prototype.addListener = function addListener(callback) {
    this.listeners.push(callback);
};
Lifecycle.prototype.trigger = function trigger() {
    var listeners = this.listeners;
    for (var i = 0, len = listeners.length; i < len; i++) {
        listeners[i]();
    }
};

// Make sure u use EMPTY_OBJ from 'inferno', otherwise it'll be a different reference
var noOp = ERROR_MSG;
{
    noOp = 'Inferno Error: Can only update a mounted or mounting component. This usually means you called setState() or forceUpdate() on an unmounted component. This is a no-op.';
}
var componentCallbackQueue = new Map();
// when a components root VNode is also a component, we can run into issues
// this will recursively look for vNode.parentNode if the VNode is a component
function updateParentComponentVNodes(vNode, dom) {
    if (vNode.flags & 28 /* Component */) {
        var parentVNode = vNode.parentVNode;
        if (parentVNode) {
            parentVNode.dom = dom;
            updateParentComponentVNodes(parentVNode, dom);
        }
    }
}
function addToQueue(component, force, callback) {
    // TODO this function needs to be revised and improved on
    var queue = componentCallbackQueue.get(component);
    if (!queue) {
        queue = [];
        componentCallbackQueue.set(component, queue);
        Promise.resolve().then(function () {
            componentCallbackQueue.delete(component);
            applyState(component, force, function () {
                for (var i = 0, len = queue.length; i < len; i++) {
                    queue[i]();
                }
            });
        });
    }
    if (callback) {
        queue.push(callback);
    }
}
function queueStateChanges(component, newState, callback, sync) {
    if (isFunction(newState)) {
        newState = newState(component.state, component.props, component.context);
    }
    for (var stateKey in newState) {
        component._pendingState[stateKey] = newState[stateKey];
    }
    if (!component._pendingSetState && isBrowser && !(sync && component._blockRender)) {
        if (sync || component._blockRender) {
            component._pendingSetState = true;
            applyState(component, false, callback);
        }
        else {
            addToQueue(component, false, callback);
        }
    }
    else {
        assign(component.state, component._pendingState);
        component._pendingState = {};
    }
}
function applyState(component, force, callback) {
    if ((!component._deferSetState || force) && !component._blockRender && !component._unmounted) {
        component._pendingSetState = false;
        var pendingState = component._pendingState;
        var prevState = component.state;
        var nextState = assign({}, prevState, pendingState);
        var props = component.props;
        var context = component.context;
        component._pendingState = {};
        var nextInput = component._updateComponent(prevState, nextState, props, props, context, force, true);
        var didUpdate = true;
        if (isInvalid(nextInput)) {
            nextInput = inferno.createVNode(4096 /* Void */);
        }
        else if (nextInput === NO_OP) {
            nextInput = component._lastInput;
            didUpdate = false;
        }
        else if (isStringOrNumber(nextInput)) {
            nextInput = inferno.createVNode(1 /* Text */, null, null, nextInput);
        }
        else if (isArray(nextInput)) {
            {
                throwError('a valid Inferno VNode (or null) must be returned from a component render. You may have returned an array or an invalid object.');
            }
            throwError();
        }
        var lastInput = component._lastInput;
        var vNode = component._vNode;
        var parentDom = (lastInput.dom && lastInput.dom.parentNode) || (lastInput.dom = vNode.dom);
        component._lastInput = nextInput;
        if (didUpdate) {
            var subLifecycle = component._lifecycle;
            if (!subLifecycle) {
                subLifecycle = new Lifecycle();
            }
            else {
                subLifecycle.listeners = [];
            }
            component._lifecycle = subLifecycle;
            var childContext = component.getChildContext();
            if (isNullOrUndef(childContext)) {
                childContext = component._childContext;
            }
            else {
                childContext = assign({}, context, component._childContext, childContext);
            }
            component._patch(lastInput, nextInput, parentDom, subLifecycle, childContext, component._isSVG, false);
            subLifecycle.trigger();
            component.componentDidUpdate(props, prevState);
            inferno.options.afterUpdate && inferno.options.afterUpdate(vNode);
        }
        var dom = vNode.dom = nextInput.dom;
        var componentToDOMNodeMap = component._componentToDOMNodeMap;
        componentToDOMNodeMap && componentToDOMNodeMap.set(component, nextInput.dom);
        updateParentComponentVNodes(vNode, dom);
        if (!isNullOrUndef(callback)) {
            callback();
        }
    }
    else if (!isNullOrUndef(callback)) {
        if (component._blockRender) {
            component.state = component._pendingState;
            component._pendingState = {};
        }
        callback();
    }
}
var Component = function Component(props, context) {
    this.state = {};
    this._blockRender = false;
    this._ignoreSetState = false;
    this._blockSetState = false;
    this._deferSetState = false;
    this._pendingSetState = false;
    this._syncSetState = true;
    this._pendingState = {};
    this._lastInput = null;
    this._vNode = null;
    this._unmounted = true;
    this._lifecycle = null;
    this._childContext = null;
    this._patch = null;
    this._isSVG = false;
    this._componentToDOMNodeMap = null;
    /** @type {object} */
    this.props = props || inferno.EMPTY_OBJ;
    /** @type {object} */
    this.context = context || inferno.EMPTY_OBJ; // context should not be mutable
};
Component.prototype.render = function render$$1 (nextProps, nextState, nextContext) {
};
Component.prototype.forceUpdate = function forceUpdate (callback) {
    if (this._unmounted) {
        return;
    }
    isBrowser && applyState(this, true, callback);
};
Component.prototype.setState = function setState (newState, callback) {
    if (this._unmounted) {
        return;
    }
    if (!this._blockSetState) {
        if (!this._ignoreSetState) {
            queueStateChanges(this, newState, callback, this._syncSetState);
        }
    }
    else {
        {
            throwError('cannot update state via setState() in componentWillUpdate().');
        }
        throwError();
    }
};
Component.prototype.setStateSync = function setStateSync (newState) {
    if (this._unmounted) {
        return;
    }
    if (!this._blockSetState) {
        if (!this._ignoreSetState) {
            queueStateChanges(this, newState, null, true);
        }
    }
    else {
        {
            throwError('cannot update state via setState() in componentWillUpdate().');
        }
        throwError();
    }
};
Component.prototype.componentWillMount = function componentWillMount () {
};
Component.prototype.componentDidUpdate = function componentDidUpdate (prevProps, prevState, prevContext) {
};
Component.prototype.shouldComponentUpdate = function shouldComponentUpdate (nextProps, nextState, context) {
    return true;
};
Component.prototype.componentWillReceiveProps = function componentWillReceiveProps (nextProps, context) {
};
Component.prototype.componentWillUpdate = function componentWillUpdate (nextProps, nextState, nextContext) {
};
Component.prototype.getChildContext = function getChildContext () {
};
Component.prototype._updateComponent = function _updateComponent (prevState, nextState, prevProps, nextProps, context, force, fromSetState) {
    if (this._unmounted === true) {
        {
            throwError(noOp);
        }
        throwError();
    }
    if ((prevProps !== nextProps || nextProps === inferno.EMPTY_OBJ) || prevState !== nextState || force) {
        if (prevProps !== nextProps || nextProps === inferno.EMPTY_OBJ) {
            if (!fromSetState) {
                this._blockRender = true;
                this.componentWillReceiveProps(nextProps, context);
                this._blockRender = false;
            }
            if (this._pendingSetState) {
                nextState = assign({}, nextState, this._pendingState);
                this._pendingSetState = false;
                this._pendingState = {};
            }
        }
        var shouldUpdate = this.shouldComponentUpdate(nextProps, nextState, context);
        if (shouldUpdate || force) {
            this._blockSetState = true;
            this.componentWillUpdate(nextProps, nextState, context);
            this._blockSetState = false;
            this.props = nextProps;
            this.state = nextState;
            this.context = context;
            inferno.options.beforeRender && inferno.options.beforeRender(this);
            var render$$1 = this.render(nextProps, nextState, context);
            inferno.options.afterRender && inferno.options.afterRender(this);
            return render$$1;
        }
        else {
            this.props = nextProps;
            this.state = nextState;
            this.context = context;
        }
    }
    return NO_OP;
};

// Type Checkers
function isVNode(instance) {
    return Boolean(instance) && isObject(instance) &&
        isNumber(instance.flags) && instance.flags > 0;
}
function isVNodeOfType(instance, type) {
    return isVNode(instance) && instance.type === type;
}
function isDOMVNode(instance) {
    return isVNode(instance) && isString(instance.type);
}
function isDOMVNodeOfType(instance, type) {
    return isDOMVNode(instance) && instance.type === type;
}
function isFunctionalVNode(instance) {
    return isVNode(instance) && Boolean(instance.flags & 8 /* ComponentFunction */);
}
function isFunctionalVNodeOfType(instance, type) {
    return isFunctionalVNode(instance) && instance.type === type;
}
function isClassVNode(instance) {
    return isVNode(instance) && Boolean(instance.flags & 4 /* ComponentClass */);
}
function isClassVNodeOfType(instance, type) {
    return isClassVNode(instance) && instance.type === type;
}
function isDOMElement(instance) {
    return Boolean(instance) && isObject(instance) &&
        instance.nodeType === 1 && isString(instance.tagName);
}
function isDOMElementOfType(instance, type) {
    return isDOMElement(instance) && isString(type) &&
        instance.tagName.toLowerCase() === type.toLowerCase();
}
function isRenderedClassComponent(instance) {
    return Boolean(instance) && isObject(instance) && isVNode(instance._vNode) &&
        isFunction(instance.render) && isFunction(instance.setState);
}
function isRenderedClassComponentOfType(instance, type) {
    return isRenderedClassComponent(instance) &&
        isFunction(type) && instance._vNode.type === type;
}
// Render Utilities
var Wrapper = (function (Component$$1) {
    function Wrapper () {
        Component$$1.apply(this, arguments);
    }

    if ( Component$$1 ) Wrapper.__proto__ = Component$$1;
    Wrapper.prototype = Object.create( Component$$1 && Component$$1.prototype );
    Wrapper.prototype.constructor = Wrapper;

    Wrapper.prototype.render = function render$$1 () {
        return this.props.children;
    };

    return Wrapper;
}(Component));
function renderIntoDocument(input) {
    var wrappedInput = createElement(Wrapper, null, input);
    var parent = document.createElement('div');
    document.body.appendChild(parent);
    return inferno.render(wrappedInput, parent);
}
// Recursive Finder Functions
function findAllInRenderedTree(renderedTree, predicate) {
    if (isRenderedClassComponent(renderedTree)) {
        return findAllInVNodeTree(renderedTree._lastInput, predicate);
    }
    else {
        throwError('findAllInRenderedTree(renderedTree, predicate) renderedTree must be a rendered class component');
    }
}
function findAllInVNodeTree(vNodeTree, predicate) {
    if (isVNode(vNodeTree)) {
        var result = predicate(vNodeTree) ? [vNodeTree] : [];
        var children = vNodeTree.children;
        if (isRenderedClassComponent(children)) {
            result = result.concat(findAllInVNodeTree(children._lastInput, predicate));
        }
        else if (isVNode(children)) {
            result = result.concat(findAllInVNodeTree(children, predicate));
        }
        else if (isArray(children)) {
            children.forEach(function (child) {
                result = result.concat(findAllInVNodeTree(child, predicate));
            });
        }
        return result;
    }
    else {
        throwError('findAllInVNodeTree(vNodeTree, predicate) vNodeTree must be a VNode instance');
    }
}
// Finder Helpers
function parseSelector(filter) {
    if (isArray(filter)) {
        return filter;
    }
    else if (isString(filter)) {
        return filter.trim().split(/\s+/);
    }
    else {
        return [];
    }
}
function findOneOf(tree, filter, name, finder) {
    var all = finder(tree, filter);
    if (all.length > 1) {
        throwError(("Did not find exactly one match (found " + (all.length) + ") for " + name + ": " + filter));
    }
    else {
        return all[0];
    }
}
// Scry Utilities
function scryRenderedDOMElementsWithClass(renderedTree, classNames) {
    return findAllInRenderedTree(renderedTree, function (instance) {
        if (isDOMVNode(instance)) {
            var domClassName = instance.dom.className;
            if (!isString(domClassName)) {
                domClassName = instance.dom.getAttribute('class') || '';
            }
            var domClassList = parseSelector(domClassName);
            return parseSelector(classNames).every(function (className) {
                return domClassList.indexOf(className) !== -1;
            });
        }
        return false;
    }).map(function (instance) { return instance.dom; });
}
function scryRenderedDOMElementsWithTag(renderedTree, tagName) {
    return findAllInRenderedTree(renderedTree, function (instance) {
        return isDOMVNodeOfType(instance, tagName);
    }).map(function (instance) { return instance.dom; });
}
function scryRenderedVNodesWithType(renderedTree, type) {
    return findAllInRenderedTree(renderedTree, function (instance) { return isVNodeOfType(instance, type); });
}
function scryVNodesWithType(vNodeTree, type) {
    return findAllInVNodeTree(vNodeTree, function (instance) { return isVNodeOfType(instance, type); });
}
// Find Utilities
function findRenderedDOMElementWithClass(renderedTree, classNames) {
    return findOneOf(renderedTree, classNames, 'class', scryRenderedDOMElementsWithClass);
}
function findRenderedDOMElementWithTag(renderedTree, tagName) {
    return findOneOf(renderedTree, tagName, 'tag', scryRenderedDOMElementsWithTag);
}
function findRenderedVNodeWithType(renderedTree, type) {
    return findOneOf(renderedTree, type, 'component', scryRenderedVNodesWithType);
}
function findVNodeWithType(vNodeTree, type) {
    return findOneOf(vNodeTree, type, 'VNode', scryVNodesWithType);
}
var index = {
    isVNode: isVNode,
    isVNodeOfType: isVNodeOfType,
    isDOMVNode: isDOMVNode,
    isDOMVNodeOfType: isDOMVNodeOfType,
    isFunctionalVNode: isFunctionalVNode,
    isFunctionalVNodeOfType: isFunctionalVNodeOfType,
    isClassVNode: isClassVNode,
    isClassVNodeOfType: isClassVNodeOfType,
    isDOMElement: isDOMElement,
    isDOMElementOfType: isDOMElementOfType,
    isRenderedClassComponent: isRenderedClassComponent,
    isRenderedClassComponentOfType: isRenderedClassComponentOfType,
    renderIntoDocument: renderIntoDocument,
    findAllInRenderedTree: findAllInRenderedTree,
    findAllInVNodeTree: findAllInVNodeTree,
    scryRenderedDOMElementsWithClass: scryRenderedDOMElementsWithClass,
    findRenderedDOMElementWithClass: findRenderedDOMElementWithClass,
    scryRenderedDOMElementsWithTag: scryRenderedDOMElementsWithTag,
    findRenderedDOMElementWithTag: findRenderedDOMElementWithTag,
    scryRenderedVNodesWithType: scryRenderedVNodesWithType,
    findRenderedVNodeWithType: findRenderedVNodeWithType,
    scryVNodesWithType: scryVNodesWithType,
    findVNodeWithType: findVNodeWithType
};

exports.isVNode = isVNode;
exports.isVNodeOfType = isVNodeOfType;
exports.isDOMVNode = isDOMVNode;
exports.isDOMVNodeOfType = isDOMVNodeOfType;
exports.isFunctionalVNode = isFunctionalVNode;
exports.isFunctionalVNodeOfType = isFunctionalVNodeOfType;
exports.isClassVNode = isClassVNode;
exports.isClassVNodeOfType = isClassVNodeOfType;
exports.isDOMElement = isDOMElement;
exports.isDOMElementOfType = isDOMElementOfType;
exports.isRenderedClassComponent = isRenderedClassComponent;
exports.isRenderedClassComponentOfType = isRenderedClassComponentOfType;
exports.renderIntoDocument = renderIntoDocument;
exports.findAllInRenderedTree = findAllInRenderedTree;
exports.findAllInVNodeTree = findAllInVNodeTree;
exports.scryRenderedDOMElementsWithClass = scryRenderedDOMElementsWithClass;
exports.scryRenderedDOMElementsWithTag = scryRenderedDOMElementsWithTag;
exports.scryRenderedVNodesWithType = scryRenderedVNodesWithType;
exports.scryVNodesWithType = scryVNodesWithType;
exports.findRenderedDOMElementWithClass = findRenderedDOMElementWithClass;
exports.findRenderedDOMElementWithTag = findRenderedDOMElementWithTag;
exports.findRenderedVNodeWithType = findRenderedVNodeWithType;
exports.findVNodeWithType = findVNodeWithType;
exports['default'] = index;

Object.defineProperty(exports, '__esModule', { value: true });

})));
