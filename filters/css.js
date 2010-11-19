exports.process = function(text) {
	return "%style\n"+text.replace(/[ ]([#.:])/g, " \\$1");
};
