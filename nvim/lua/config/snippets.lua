local ls = require("luasnip")
local s = ls.snippet
local sn = ls.snippet_node
local t = ls.text_node
local i = ls.insert_node
local f = ls.function_node
local d = ls.dynamic_node
local fmt = require("luasnip.extras.fmt").fmt
local fmta = require("luasnip.extras.fmt").fmta
local rep = require("luasnip.extras").rep

local date = function()
	return { os.date("%Y-%m-%d") }
end

ls.add_snippets("all", {
	s({
		trig = ":class",
		namr = "Vue Class",
		dscr = "Class binding in Vue",
	}, {
		t({ ":class=\"{'" }),
		i(1, "class_name"),
		t({ "': true}\"" }),
		i(0),
	}),
	s(
		{
			trig = "GROW%-(%d+)",
			trigEngine = "pattern",
            docTrig = "GROW-",
			namr = "Jira ticket",
			dscr = "Jira GROW ticket link",
		},
		f(function(_, snp)
			print("CAPTURED:", snp.captures[1])
			return "https://belmonttechinc.atlassian.net/browse/GROW-" .. snp.captures[1]
		end, {})
	),
	s(
		{
			trig = "iferr",
			namr = "If Error",
			dscr = "If Error is not nil",
		},
		fmta(
			[[if err != nil {
	return <>
}]],
			{ i(1, "err") }
		)
	),
	s({
		trig = "date",
		namr = "Date",
		dscr = "Date in the form of YYYY-MM-DD",
	}, {
		f(date, {}),
	}),
})
