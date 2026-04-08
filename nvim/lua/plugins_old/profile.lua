return {
	{
		"stevearc/profile.nvim",
		config = function()
			-- local should_profile = vim.env.NVIM_PROFILE
			-- if not should_profile then
			-- 	return
			-- end

			local profile = require("profile")

			profile.instrument_autocmds()
			-- if should_profile:lower():match("^start") then
			-- 	profile.start("*")
			-- else
			-- 	profile.instrument("*")
			-- end

			vim.keymap.set("n", "<f4>", function()
				local prof = profile
				if prof.is_recording() then
					prof.stop()
					vim.ui.input(
						{ prompt = "Save profile to:", completion = "file", default = "profile.json" },
						function(filename)
							if filename then
								prof.export(filename)
								vim.notify(("Wrote %s"):format(filename))
							end
						end
					)
				else
					local profileName = vim.fn.input("Enter profile name (or leave empty for full): ")

					vim.notify("Starting recording")
					prof.start(profileName .. "*")
				end
			end)
		end,
	},
}
