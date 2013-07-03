
	function getParamFunc(getParam, setParam, obj){
		return function(data, widthBaseParam){
			if (isPlainObject(data)) {
				setParam(data, widthBaseParam);
				return obj;
			} else {
				return getParam(data, widthBaseParam);
			}
		};
	}
	function getRunParamFunc(run, base, paramFunc){
		extendDeep(paramFunc, base);
		extend(paramFunc, run);
		return paramFunc;
	}
	

	function setDisabledCall(funcData){
		funcData.disabled = true;
	}

	function findFuncInList(func, list, callback){
		forEach(list, function(funcData){
			if (funcData.func === func) callback(funcData);
		});
	}
	

	function returnFalseFunc(){
		return false;
	}


	return function(defaultCall, _obj){
		var _before = [],
			_after = [],
			_final = [],
			_baseParam = {},
			_runParam = {};
		

		function getList(stepName) {
			return stepName == 'after' ? _after : stepName == 'final' ? _final : _before;	
		}
		function addEventListener(stepName, data, func){
			if (!func) {
				func = data;
				data = {};
			}
			if (!func) {
				func = stepName;
				stepName = '';
			}

			var funcData = {
				data: data,
				func: func,
				disabled: false
			};

			getList(stepName).push(funcData);

			return funcData;
		}
		function setParam(data, widthBaseParam){
			if (widthBaseParam) extend(_baseParam, data);
			extend(_runParam, data);
		}
		function getParam(name, isBaseParam){
			return isBaseParam ? _baseParam[name] : _runParam[name];
		}
		function removeParam(name, widthBaseParam) {
			if (widthBaseParam) delete _baseParam[name];
			delete _runParam[name];
		}
		
		

		return {
			'on': function(){
				addEventListener.apply(null, arguments);
				return _obj;
			},
			'off': function(stepName, func){
				if (stepName && func) {
					findFuncInList(func, getList(stepName), setDisabledCall);
				} else if (stepName) {
					if (typeof(stepName) == 'function') {
						findFuncInList(stepName, _before, setDisabledCall);
						findFuncInList(stepName, _after, setDisabledCall);
						findFuncInList(stepName, _final, setDisabledCall);
					} else {
						forEach(getList(stepName), setDisabledCall);
					}
				} else {
					forEach(_before, setDisabledCall);
					forEach(_after, setDisabledCall);
					forEach(_final, setDisabledCall);
				}

				return _obj;
			},
			'once': function(){
				var funcData = addEventListener.apply(null, arguments);
				addEventListener('final', function(){
					funcData.disabled = true;
				});
			},
			'param': getParamFunc(getParam, setParam, _obj),
			'removeParam': removeParam,
			'trigger': function(){
				if (defaultCall) return defaultCall.apply(_obj, arguments);
			},
			'emit': function(){
				var args = toArray(arguments),
					defCall = defaultCall,
					curIndex, curFuncData, curList,

					isStop = false,
					isDefaultPrevented = false,
					runList = function(list, startIndex){
						curList = list;
						for (curIndex = startIndex; !isStop && curIndex < list.length; curIndex++) {
							curFuncData = list[curIndex];
							if (curFuncData.disabled) {
								list.splice(curIndex, 1);
								curIndex--;
								continue;
							}

							args[0] = new Event();

							if ((EventProto['preReturn'] = curFuncData.func.apply(_obj, args)) === false) {
								isStop = true;
								return false;
							}
						}

						return true;
					},
					setDefaultReturn = function(defReturn){
						EventProto['defaultReturn'] = defReturn;
						return true;
					},
					isInAsync = false,
					hasRunAfter = false,
					runAfter = function(){
						hasRunAfter = true;
						EventProto['preventDefault'] = returnFalseFunc;
						EventProto['overrideDefault'] = returnFalseFunc;
						// defaultCall run
						if (!isStop && !isDefaultPrevented) {
							EventProto['defaultReturn'] = EventProto['preReturn'] = defCall ? defCall.apply(_obj, arguments) : undefined;
						}

						EventProto['setDefaultReturn'] = setDefaultReturn;

						// after list run
						if (!isDefaultPrevented) runList(_after, 0);
					},
					hasRunFinal = false,
					runFinal = function(){
						// final list run
						isStop = false;		// 为final 重置isStop
						runList(_final, 0);
					},
					myRunParam = getRunParamFunc(_runParam, _baseParam, getParamFunc(getParam, setParam, _obj)),
					Event = function(){
						this['data'] = curFuncData.data;
					},
					EventProto = Event.prototype = {
						'isDefaultPrevented': false,
						'isDefaultOverrided': false,
						'param': myRunParam,
						'removeParam': removeParam,
						'setDefaultReturn': returnFalseFunc,
						'off': function(){
							curFuncData.disabled = true;
						},
						'next': function(){			// 调用next只可能返回两种值 true 和 false
							return runList(curList, ++curIndex);
						},
						'preventDefault': function(defReturn){
							isDefaultPrevented = true;
							EventProto['isDefaultPrevented'] = true;
							EventProto['preventDefault'] = EventProto['setDefaultReturn'] = setDefaultReturn;
							EventProto['overrideDefault'] = returnFalseFunc;
							
							return setDefaultReturn(defReturn);
						},
						'overrideDefault': function(newDefaultReturn){
							defCall = newDefaultReturn;
							EventProto['isDefaultOverrided'] = true;
							EventProto['setDefaultReturn'] = setDefaultReturn;
							return true;
						},
						'async': function(){
							isInAsync = true;

							return function(){
								runList(curList, ++curIndex);
								if (!hasRunAfter) runAfter();
								if (!hasRunFinal) runFinal();
							};
						}
					};

				_runParam = {};			// 清空 防止影响到内部的嵌套调用


				args.unshift(null);			// Event placeholder

				// before list run
				runList(_before, 0);

				if (!isInAsync) runAfter();
				if (!isInAsync) runFinal();

				return EventProto['defaultReturn'];
			}
		};
	};