local ls = require("luasnip")
-- some shorthands...
local snip = ls.snippet
local fmt = require("luasnip.extras.fmt").fmta
local node = ls.snippet_node
local text = ls.text_node
local insert = ls.insert_node
local func = ls.function_node
local choice = ls.choice_node
local dynamicn = ls.dynamic_node

local date = function()
	return { os.date("%Y-%m-%d") }
end

ls.add_snippets(nil, {
	all = {
		snip({
			trig = ":class",
			namr = "Vue Class",
			dscr = "Class binding in Vue",
		}, {
			text({ ":class=\"{'" }),
			insert(1, "class_name"),
			text({ "': true}\"" }),
			insert(0),
		}),
		snip(
			{
				trig = "iferr",
				namr = "If Error",
				dscr = "If Error is not nil",
			},
			fmt(
				[[if err != nil {
	return <>
}]],
				{ insert(1, "err") }
			)
		),
		snip({
			trig = "date",
			namr = "Date",
			dscr = "Date in the form of YYYY-MM-DD",
		}, {
			func(date, {}),
		}),
	},
})
