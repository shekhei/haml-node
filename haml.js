var fs = require('fs');

// lets read and include all filters
var modulePath = require('path').dirname(module.filename);
var filters = fs.readFileSync(modulePath+"/filters/filters");
filters = JSON.parse(filters);
for ( key in filters ) {
	filters[key] = require('./filters/'+filters[key]);
}

var getTag = /^%([\w]+)/
var getClasses = /[.]([\w\d]+)/g
var getID = /[#]([\w\d]+)/

var HTMLJSEND = "');";
var HTMLJSSTART = "output.write('";

var findEscapeCharactersRegExp = /(["'])/g

var escape_quote = function(str) {
	return str.replace(findEscapeCharactersRegExp, "\\$1");
}

var buildVarArrOutput = function(classes, id, variableStr) {
	return "buildVarArrOutput('"+classes+"','"+id+"',"+variableStr+");\n";
}

var outputFunctions = function() {
	return "var buildVarArrOutput = "+buildArrFunc.toString()+";\n";
};

var isEmbedOutputOnly = /^=[\s]*([.\d\w]+)[ ]*$/;
var isSelector = /^[#.%:]/
var getFirstNonSpace = /[^ ]/;
var getSelectorEnd = /[ {\n=]/;

var DOCTYPES = {
	"default" : "<!doctype html>",
	"Strict" : "<!DOCTYPE html PUBLIC \\'-//W3C/DTD XHTML 1.0 Strict//EN\\' \\'http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\\'>",
	"Frameset" :"<!DOCTYPE html PUBLIC \\'-//W3C/DTD XHTML 1.0 Frameset//EN\\' \\'http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd\\'>", 
	"5" : "<!DOCTYPE html>",
	"1.1" : "<!DOCTYPE html PUBLIC \\'-//W3C//DTD XHTML 1.1//EN\\' \\'http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\\'>",
	"Basic" : "<!DOCTYPE html PUBLIC \\'-//W3C//DTD XHTML Basic 1.1//EN\\' \\'http://www.w3.org/TR/xhtml11/DTD/xhtml-basic11.dtd\\'>",
	"Mobile" : "<!DOCTYPE html PUBLIC \\'-//W3C//DTD XHTML Mobile 1.2//EN\\' \\'http://www.openmobilealliance.org/tech/DTD/xhtml-mobile12.dtd\\'>",
	"RDFa" : "<!DOCTYPE html PUBLIC \\'-//W3C//DTD XHTML+RDFa 1.0/EN\\' \\'http://www.w3.org/MarkUp/DTD/xhtml-rdfa-1.dtd\\'>",
	"XML" : "<\\?xml version=\\'1.0\\' encoding=\\'utf-8\\' \\?>"
};

var buildArrFunc = function( classes, id, variables ) {
	if ( variables.class ) {
		variables.class = ((variables.class.join) ? variables.class.join(" ") : variables.class)+classes;
	}
	else if ( classes.length > 0 ){
		variables.class = classes;
	}
	if ( variables.id ) {
		variables.id = id + "_" + ((variables.id.join) ? variables.id.join("_") : variables.id);
	}
	else if ( id.length > 0 ) {
		variables.id = id;
	}
	var buffer = [];
	for ( variable in variables ) {
		buffer.push(variable+"='"+variables[variable]+"'" );
	}
	output.write(" "+buffer.join(" "));
};

var interpolation = /#{(.*?)}/g;
var hasInterpolate = /#{/;

var parseHamlBody = function(data) {
	var js = [HTMLJSSTART];
	var currentScope = 0;
	var lastScope = 0;
	var STATES = { scope: 0, selector: 1, variables: 2, text: 3, code: 4, codeblock: 5, comment: 6, skip: 7, filter: 8}
	var state = STATES.scope;
	var selector = "";
	var variables = "";
	var tabs = "";
	var remaining = "";
	var ends = [];
	var ignoreTillNewLine = false;
	var ignoreNewLine = false; // this is use when | or , is used to connect lines
	var endScope = false;

	for ( var i = 0; i < data.length; i++ ) {
		c = data[i];
		if ("\n" == c && !ignoreNewLine && STATES.filter != state) {
			ignoreTillNewLine = false;
			endScope = false;
			if ( STATES.skip != state ) {
				js.push("\\n", tabs);
				state = STATES.scope;
				if ( selector.length > 0 ) {
					// lets handle the case of filters
					if ( ":" ==  selector[0] ) {
						state = STATES.filter;
					}
					else {
						var classes = selector.match(getClasses);
						classes = (classes) ? classes.join("").replace(/[.]/g, " ") : "";
						var id = getID.exec(selector);
						id = (id) ? id[1] : "";
						var tag = getTag.exec(selector);
						tag = (tag) ? tag[1] : "div";
						js.push("<", tag);
						if ( variables.length > 0 ) {
							js.push(HTMLJSEND,buildVarArrOutput(classes, id, variables),HTMLJSSTART);
						}
						else {
							if ( classes.length > 0 ) {
								js.push(" class=\\'", classes, "\\'");
							}
							if ( id.length > 0 ) {
								js.push(" id=\\'", id, "\\'");
							}
						}
						if ( selector.charAt(selector.length-1) == "/") {
							js.push("/");
						}
						else {
							if ( lastScope != currentScope ) {
								ends.unshift("\\n"+tabs+"</"+tag+">");
							}
							else {
								ends.unshift("</"+tag+">");
							}
						}
						js.push(">");
					}
				}
				if ( remaining[0] == "-" ) {
					// if it is with a # next, change state to comment block
					if ( remaining[1] == "#" ) {
						state = STATES.skip;
					}
					else {
						js.push(HTMLJSEND, remaining.substr(1).replace(interpolation, HTMLJSEND+"output.write($1);"+HTMLJSSTART), "{", HTMLJSSTART);
						ends.unshift(HTMLJSEND+"}"+HTMLJSSTART);
					}
					remaining = "";
				}
				else if ( remaining[0] == "=" ) {
					js.push(HTMLJSEND);
					if ( isEmbedOutputOnly.test(remaining) ) {
						// wrap it with output.write;
						js.push("output.write(", remaining.substr(1), ");");
					}
					else {
						js.push(remaining.substr(1)+";");
					}
					js.push(HTMLJSSTART);
					remaining = "";
				}
				else if ( remaining[0] == "/" ) {
					js.push("<!--");
					ends.unshift("-->");
					remaining = remaining.substr(1);
				}
				js.push(escape_quote(remaining).replace(interpolation, HTMLJSEND+"output.write($1);"+HTMLJSSTART));
				remaining = "";

				lastScope = currentScope;
			}
			else if ( lastScope >= currentScope ) {
				// lets handle the filter case here
				if ( STATES.filter == state ) {
				}
				// lets escape from skipping/filtering
				state = STATES.scope;
			}
			// this is for printing pure text
			if ( remaining.length > 0 && state != STATES.filter) {
				// condition is use here 
				js.push("\\n", tabs, escape_quote(remaining).replace(interpolation, HTMLJSEND+"output.write($1);"+HTMLJSSTART));
			}
			variables = "";
			if ( state != STATES.filter ) {
				selector = "";
				remaining = ""; // do not clear if it is filter, cause this should all go into the filter
			}
			tabs = "";
			currentScope = 0;
		}
		else if ( !ignoreTillNewLine ){ // not new line yet
			if ( STATES.scope == state) {
				if ( " " == c ) {
					currentScope++;
					tabs += c;
				}
				else {
					if ( ends.length > currentScope ) {
						js.push(ends.splice(0, ends.length-currentScope).join(""));
					}
					// time to output the end tags
					// skip if state is skip/filter
					if ( STATES.skip != state && STATES.filter != state ) {
						if ( isSelector.test(c) && /^[\w]/.test(data[i+1])) {
							state = STATES.selector;
							selector += c;
						}
						else {
							state = STATES.text;
							remaining += c;
						}
					}
				}
			}
			else if (STATES.skip == state) {
				if ( c == " ") {
					currentScope++;
				}
				else {
					ignoreTillNewLine = true;
				}
			}
			else if ( STATES.selector == state ) {
				if ( /^[ =]/.test(c) ) {
					state = STATES.text;
					remaining += c;
				}
				else if ( "{" == c ) {
					state = STATES.variables;
					variables += c;
				}
				else {
					selector += c;
				}
			}
			else if ( STATES.filter == state ) {
				if ( c == " " && !endScope) {
					currentScope++;
					tabs += c;
				}
				else if ( c == "\n" ) {
					endScope = false;
					currentScope = 0;
					tabs = "";
				}
				else {
					endScope = true;
				}
				if ( data[i+1] != " " && lastScope >= currentScope ) {
					filter = filters[selector.substr(1)];
					var output = filter.process(remaining);
					if ( filter.compile ) {
						output = filter.compile(output);
					}
					else {
						output = parseHamlBody(output);
					}
					js.push(HTMLJSEND, output, HTMLJSSTART);
					selector = "";
					variables = "";
					remaining = "";
					state = STATES.scope;
				}
				else {
					remaining += c;
				}
			}
			else if ( STATES.variables == state ) {
				if ( "}" == c ) {
					state = STATES.text;
				}
				else if ( "," == c ) {
					if ( data[i+1] == "\n" ) {
						ignoreNewLine = true;
					}
				}
				else if ( "\n" == c ) {
					ignoreNewLine = false;
				}
				variables += c;
			}
			else {
				remaining += c;
			}
		}
	}
	if ( STATES.filter == state ) {
		filter = filters[selector.substr(1)];
		var output = filter.process(remaining);
		if ( filter.compile ) {
			output = filter.compile(output);
		}
		else {
			output = parseHamlBody(output);
		}
		js.push(HTMLJSEND, output, HTMLJSSTART);
		selector = "";
		variables = "";
		remaining = "";
	}
	js.push(escape_quote(remaining).replace(interpolation, HTMLJSEND+"output.write($1);"+HTMLJSSTART), ends.join(""));
	js.push(HTMLJSEND);
	return js.join("");
}
var parseHaml = function(data) {
	// probably should trim the end of lines, cause it will affect this significantly
	// leaving the space or adding the space there to ease parsing
	// first lets detect the spaces
	var scope = "  ";
	// lets first trim all start newlines
	if ( data.charCodeAt(0) == 0xFEFF ) {
		data = data.substr(1);
	}
//	data = data.replace(/^[\n]*/, "\n")
	var headEnd = data.search(/^[^!\n]/m);
	var headData = [];
	head = data.substr(0,headEnd)
				.replace(/!!![\s]*([^\n]+)[\n]*/g, "$1|")
				.split("|");
	for( var i = 0; i < head.length; i++ ) {
		if ( head[i].length > 0 ) {
			head[i] = head[i].split(' ');
			if ( typeof DOCTYPES[head[i][0]] == "undefined") {
				headData.push(DOCTYPES['default']);
			}
			else {
				// this is a special case, using xml encoding, irritating!
				if ( head[i][0] == "XML" && typeof head[i][1] != "undefined" ) {
					headData.push(DOCTYPES[head[i][0]].replace("utf-8", head[0][1]));
				}
				else {
					headData.push(DOCTYPES[head[i][0]]);
				}
			}
		}
	}
	var js = [outputFunctions(), HTMLJSSTART, headData.join("\\n")];

	data = data.substr(headEnd)
				.replace(/[\s]*$/m, "");

	var scope_find = data.match(/[\n][\s]+/);
	if ( scope_find ) {
		scope = scope_find[0].substr(1);
	}
	data = data.replace(new RegExp(scope, "g"), " ");
	var js = [outputFunctions(), HTMLJSSTART, headData.join("\\n"), HTMLJSEND, parseHamlBody(data)];
	return js.join("");
}
/**
 * load(dataStr, callback) 
 * dataStr is of type string
 * callback of two parameters, error and data
 */
var load = exports.load = function(dataStr, callback) {
	if ( typeof callback != "function" ) { throw "Haml.load callback has to be defined"; }
	callback(null, parseHaml(dataStr)+"\noutput.done();");
};

var loadFile = exports.loadFile = function(filename, callback) {
	if ( typeof callback != "function" ) { throw "Haml.loadFile callback has to be defined"; }
	fs.readFile(filename, function(err, data) {
			if ( err ) {
				callback(err, null);
				return;
			}
			load(data.toString(), callback);
	}); 
};
