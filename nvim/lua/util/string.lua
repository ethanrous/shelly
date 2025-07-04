function string.endsWith(String, End)
	return string.sub(String, string.len(String) - string.len(End) + 1) == End
end
