const json = `
{
	"name"
: "ly666",
	"age": 123,
	"child": {
		"name1": "xy"
	}
}
`;
console.log(json.replace(/"([^"]*)"\s*:/gm, '$1:'));

/*
=>
{
	name: "ly666",
	age: 123,
	child: {
		name1: "xy"
	}
}
*/

