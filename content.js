/*	*****	LICENCE	*****
 *
 *	Copyright (c) 2020 Alex Go, ToChunkA.
 *	All rights reserved.
 *
 *  This software is distributed on an "AS IS" basis,
 *	WITHOUT WARRANTY OF ANY KIND, either express or 
 *	implied.
 *
 *	*****	LICENSE	END ***** */

//TODO: 
//	-	додати усічення початкових та кінцевих пробільних символів 
//		textContent в Readability.

//		Можна викор. більш простий варіант - без встановлення
//	постійного з'єднання:
//	https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Content_scripts#Communicating_with_background_scripts#One-off_messages
var myPort = browser.runtime.connect();

function SendPageData()
	{
		function SendProxyPageData(AOutboundLink,
																			AProxyDocURI,
																			AProxyDocTitle)
			{
				var OriginDocURL = AOutboundLink.href;
				var OriginDocURI = {	spec: OriginDocURL,
															host: AOutboundLink.host,
															prePath: AOutboundLink.protocol + "//" + AOutboundLink.host,
															scheme: AOutboundLink.protocol.substr(0, AOutboundLink.protocol.indexOf(":")),
															pathBase: 	(		AOutboundLink.protocol 
																						+ "//" + AOutboundLink.host 
																						+ AOutboundLink.pathname.substr(0, AOutboundLink.pathname.lastIndexOf("/") + 1))};

				myPort.postMessage({ "PageData":  
															{"OriginPageData": 
																	{
																		uri: OriginDocURI
																	},
															"title": AProxyDocTitle,
															"uri": AProxyDocURI}});
			}
		
		function SendYouTubePageData(AURI)
			{
				var DescriptionElem = document.getElementById('description');
				if (DescriptionElem)
					{
						var ByLine = document.getElementById('channel-name').innerText;
						
						var H1HeaderS = document.getElementsByTagName('h1');
						var Title = H1HeaderS[0].textContent;
						
						var Excerpt = DescriptionElem.textContent;
					
						var RefURLS = [];
						var RefLinkS = DescriptionElem.getElementsByTagName('a');

						for(var i = 0, len = RefLinkS.length; i < len; i++)
							{
								RefLink = RefLinkS[i];
								var RefURL = RefLink.href;

								// Відносні шляхи переводимо в абсолютні.
								if (RefURL.indexOf('/') == 0)
									{
										RefURL = AURI.pathBase + RefURL;
									}
								
								// Із посилання для перенаправлення ...
								var OriginRedirectURLRERes = RefURL.match(/redirect\?.*?q=(.+?)(?:&|$)/);
								if (OriginRedirectURLRERes)
									{
										// ... відновлюємо орігінальнe URL.
										RefURL = decodeURIComponent(OriginRedirectURLRERes[1]);
									}

								RefURLS.push(RefURL);
							}
						
						//		В майбутньому може вийде додати стенограму 
						// відео в якості textContent, але поки коротого
						// витягу - Excerpt, більш ніж достатньо.
						myPort.postMessage({ 
																	"PageData": 
																		{
																			uri: AURI,
																			title: Title,
																			byline: ByLine,
																			dir: null,
																			content: null,
																			textContent: null,
																			length: 0,
																			excerpt: Excerpt,
																			IsExcerptFirstP: false,
																			RefURLS: RefURLS
																		}});
					}
				else
					{
						// 	Подія OnLoad документу не підходить, бо вона викон. раніше.
						// Тому просто чекає поки з'являться всі потрібні елементи 
						// із вмістом.
						setTimeout(function () { SendYouTubePageData(AURI); }, 250);
					}
			};
		
		if (myPort)
			{
				var loc = document.location;
				var URI = {	spec: loc.href,
										host: loc.host,
										prePath: loc.protocol + "//" + loc.host,
										scheme: loc.protocol.substr(0, loc.protocol.indexOf(":")),
										pathBase: loc.protocol + "//" + loc.host + loc.pathname.substr(0, loc.pathname.lastIndexOf("/") + 1)};
			
				var IsPageDataSent = false;

				if (loc.host.indexOf('www.reddit.com') > -1)
					{
						var PostContent = document.querySelector('div[data-test-id="post-content"]');
						var OutboundLinkS = PostContent.getElementsByClassName('styled-outbound-link');
					
						if (OutboundLinkS.length > 0)
							{
								var OutboundLink = OutboundLinkS[0];
								var PostHeaderS = PostContent.getElementsByTagName('h1');
								var PostHeaderText = PostHeaderS[0].textContent;
						
								SendProxyPageData(OutboundLink,
																					URI,
																					PostHeaderText);
								IsPageDataSent = true;
							}
					}
				else if (loc.host.indexOf('pushtokindle.fivefilters.org') > -1)
					{
						//		Для пошуку посилання немає підходящих ключів, тому 
						//	беремо адресу посилання з адреси самої сторінки.
						var OriginDocURLRERes = loc.href.match(/send.php\?url=(.+?)(?:&|$)/);

						if (OriginDocURLRERes)
							{
								//		Через це, для відповідності параметрам 
								//	SendProxyPageData(..), створюємо
								//	фіктивне посилання.
								var OutboundLink = document.createElement('a');
								OutboundLink.href = decodeURIComponent(OriginDocURLRERes[1]);

								SendProxyPageData(OutboundLink, URI, null);
								IsPageDataSent = true;
							}
					}
				else if (loc.host.indexOf('news.ycombinator.com') > -1)
					{
						var StoryLinkS = document.getElementsByClassName('storylink');

						if (StoryLinkS)
							{
								var StoryLink = StoryLinkS[0];
								if (StoryLink)
									{
										SendProxyPageData(StoryLink,
																							URI,
																							StoryLink.textContent);
										IsPageDataSent = true;
									}	
							}
					}
				else if (loc.host.indexOf('www.youtube.com') > -1)
					{
						SendYouTubePageData(URI);
						IsPageDataSent = true;
					}
				
				// 		Якщо документ до цього не був оброблений в 
				//	індивідуальному порядку, то ...
				if (!IsPageDataSent)
					{
						//	... створюємо його документу, щоб його Readability 
						//	не змінив під час обробки.
						var DocWorkCopy = document.cloneNode(true);
						var Article = new Readability(URI, DocWorkCopy).parse();
						
						Article.OriginPageData = null;
						
						myPort.postMessage({ "PageData": Article });
					}
			}
	};

myPort.onMessage.addListener(function(AMsg)
	{
		if (AMsg && AMsg == "SendPageData")
			{
				SendPageData();
			}
	});