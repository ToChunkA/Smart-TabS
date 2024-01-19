var DefaultExcludeDomainS = [	'todoist.com', 'trello.com', 'feedly.com', 
															'gmail.com', 'mail.google.com',
															'analytics.google.com', 'adsense.google.com',
															'google.com\/adsense', 'accounts.google.com',
															'google.com\/webmasters', 'search.google.com',
															'translate.google.com', 'facebook.com',
															'inoreader.com', 'netflix.com'];

function GetDomainSSearchRE(ADomainS)
	{
		//		Якщо перелік не визначено, то ...
		if ((!ADomainS) || (ADomainS.length == 0))
			{
				//	... виходимо, повертаючи 
				//	порожній результат.
				//		Т.ч., зокрема, уникаємо 
				//	помилки 
				//	TypeError: initialValue 
				//	в 'reduce(...)'.
				return null;
			}
		
		var CommonURLPart = 'https?:\/\/(www\.)?';
		var CommonURLPartRE = new RegExp(CommonURLPart);

		return new RegExp('^{COMMON_PART}({DOMAINS})'
												.replace(		'{COMMON_PART}'
																	, CommonURLPart)
												.replace(		'{DOMAINS}'
																	, ADomainS
																			.map(function(AElem) 
																						{ 
																							return (AElem
																												.replace(CommonURLPartRE, '')
																												.replace(/\./g, "\\.")); 
																						})
																			.reduce(function(A,B)
																								{ return A + '|'+ B; })));
	};

var DefaultSortByURLDomainS = ['github.com', 'gitlab.com'];