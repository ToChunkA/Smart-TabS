/*	*****	LICENSE	*****
 *
 *	Copyright (c) 2020-2024 Alex Go, ToChunkA.
 *	All rights reserved.
 *
 *  This software is distributed on an "AS IS" basis,
 *	WITHOUT WARRANTY OF ANY KIND, either express or 
 *	implied.
 *
 *	*****	LICENSE	END ***** */

//TODO: 
//	-	add leading and trailing space symbols trim in 'textContent' from Readability.

//		Simpler approach can be used - without persistent connection:
//	https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Content_scripts#Communicating_with_background_scripts#One-off_messages
var myPort = browser.runtime.connect();

var IsSendingPageData = false;

function SendPageData()
	{	
		function SendProxyPageData(AOutboundLink, AProxyDocURI, AProxyDocTitle)
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
			};
		
		var MaxSendYouTubePageDataAttempts = 6;
		var CurrSendYouTubePageDataAttempts = 0;
		
		function SendYouTubePageData(AURI)
			{
				var DescriptionElem = null;
				
				//		Searching for an HTML element with a full(expanded) video description.
				
				//		Ones there was a '<script id="scriptTag" ...' with structured data, 
				//	but now there is a global variable 'ytInitialData' instead.
				//		Structured data seems to be more suitable to use, but they are 
				//	not stable, and we need to render links from description anyway. 
				//		Hence we do not benefit from structured data we are keep looking 
				//	for an HTML elements.
				var DescriptionElemS = document.querySelectorAll("#description");
				
				for(var i = 0, len = DescriptionElemS.length; i < len; i++)
					{
						var TmpDescElem = DescriptionElemS[i];
						
						if (			(TmpDescElem.tagName.toLowerCase() == 'div')
								&&	(TmpDescElem.className.search(/exp.+?\-video\-description/) > -1))
							{
								DescriptionElem = TmpDescElem;
								
								break;
							}
					}				
				
				if (DescriptionElem)
					{
						var ByLine = document.getElementById('channel-name').innerText;
						
						var Title = document.querySelectorAll(".watch-active-metadata h1")[0].textContent;
						
						var Excerpt = DescriptionElem.textContent;
					
						var RefURLS = {};
						var RefLinkS = DescriptionElem.getElementsByTagName('a');

						for(var i = 0, len = RefLinkS.length; i < len; i++)
							{
								var RefLink = RefLinkS[i];
								var RefURL = RefLink.href;

								// Transforming relative path into absolute.
								if (RefURL.indexOf('/') == 0)
									{
										RefURL = AURI.pathBase + RefURL;
									}
								
								// From redirect link ...
								var OriginRedirectURLRERes = RefURL.match(/redirect\?.*?q=(.+?)(?:&|$)/);
								
								if (OriginRedirectURLRERes)
									{
										// ... restoring original URL.
										RefURL = decodeURIComponent(OriginRedirectURLRERes[1]);
									}

								RefURLS[RefURL] = 0;
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
						//		Подія OnLoad документу не підходить, бо вона викон. раніше.
						// Тому просто робимо певну кількість спроб отримати всі потрібні 
						// елементи із вмістом. 
						// 		Обмеження на к-сть спроб додано на випадок зміни верстки 
						// вмісту, щоб перевірка не зациклилась через відсутність
						// очікуваних елементів, які були змінені.
						if (CurrSendYouTubePageDataAttempts < MaxSendYouTubePageDataAttempts)
							{
								setTimeout(		function ()
																{ 
																	SendYouTubePageData(AURI);
																	// 	Фіксуємо нову спробу саме у 
																	// середині closure інакше будуть 
																	// мутації значення.
																	CurrSendYouTubePageDataAttempts++;
																}
														, 250);
							}
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
						//TODO:
						//	-	add youtube embed support: 
						//		PostContent.querySelector('shreddit-embed').
						//		PostContent.querySelector('shreddit-embed').shadowRoot.querySelector('lite-youtube').videoId 
						var PostContent = document.querySelector('shreddit-post');
						var OutboundLinkS = PostContent.querySelectorAll('div[slot="post-media-container"] a');
						
						// If there is a link, then it is a proxy-post, so ...
						if (OutboundLinkS.length > 0)
							{
								// ... we are processing it in a specific way.
								var OutboundLink = OutboundLinkS[0];
								var PostHeaderText = PostContent.querySelector('h1').textContent;
								
								SendProxyPageData(OutboundLink, URI, PostHeaderText);
								
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
								//	SendProxyPageData(...), створюємо
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
						//	... створюємо копію документу, щоб 
						// 	Readability його не змінив під час 
						//	обробки.
						var DocWorkCopy = document.cloneNode(true);
						var Article = new Readability(URI, DocWorkCopy).parse();
						
						Article.OriginPageData = null;
						
						myPort.postMessage({ "PageData": Article });
					}
			}
	};

myPort.onMessage.addListener(function(AMsg)
	{
		if (AMsg && (AMsg == "SendPageData"))
			{
				// 		If we are already processing the page  
				//	content and sending result to background.js, 
				//	then ...
				if (IsSendingPageData)
					{
						//	... we drop another attemp to do it.
						return true;
					}
				
				// 	Mark that we are processing the page content. 
				IsSendingPageData = true;
				
				//		Визначаємо чи відправляти дані про сторінку, у залежності
				//	від налаштувань переліку доменів, які викл. користувачем із
				//	обробки.
				//		Цей код відповідає аналогічному коду із background.js, 
				//	і його додано для доповнення перевірки з 
				//	background.js -> AddContScriptMsgListener(...), оскільки
				//	встановлення зв'язку із завантаженими сторінками відбувається
				//	раніше за аналогічне завантаження налаштування 
				//	"UserExcludeDomainS" в background.js.
				//		Можливо, це не зовсім архітектурно, бо дублюється логіка 
				//	і код, але так було швидше реалізувати.
				browser.storage.local.get({"UserExcludeDomainS": DefaultExcludeDomainS})
					.then(function(ALocStorageData)
									{ 
										var ExcludeDomainSRE = null;

										if (		ALocStorageData 
												&&	ALocStorageData.UserExcludeDomainS)
											{
												ExcludeDomainSRE = 
													GetDomainSSearchRE(ALocStorageData.UserExcludeDomainS);
											}

										//		Якщо користувач не визначив домени, сторінки яких 
										//	мають бути виключені із обробки, або поточна сторінка
										//	не відноситься до такого домену, тоді ...
										if (			(!ExcludeDomainSRE) 
													||	(!ExcludeDomainSRE.test(document.location.href)))
											{
												//	... відправляємо дані сторінки на обробку.
												SendPageData();
											}
									})
					.finally(function() 
											{
												//		Час затримки відкриття обробки вмісту 
												//	сторінки обрано таким чином, щоб з одного
												//	боку не виконувати її занадто часто, з 
												//	іншого - так, щоб у разі помилки 
												//	background.js міг відправити ще один запит. 
												//	Див. параметри повторного запиту вмісту 
												//	сторінок.
												setTimeout(		function()
																				{
																					IsSendingPageData = false;
																				}
																		,	2000);
											});
			}
	});

browser
	.runtime
		.onMessage
			.addListener(function(AMsg)
										{
											if (AMsg.Key && (AMsg.Key == 'UpdTabTitle'))
												{
													document.title = AMsg.NewTabTitle;
												}
											else if (AMsg.Key && (AMsg.Key == 'SimReadLaterBookmarkS'))
												{
													var PopUpDivID = 'sim_read_later_bkmarks_popup';

													if (document.querySelector('#{ELEM_ID}'.replace('{ELEM_ID}', PopUpDivID)))
														{
															return false;
														}
													
													var StyleBlockID = 'tcast_stl';
													// 		З такою умовою після оновлення розширення, яке містить нові стилі,
													//	вони не завантажаться допоки не буде оновлено сторінку.
													//		Це не така вже і критична проблема, зате код більш простіший, на чому
													//	економимо час.
													//		Аналогічно і для блоку SCRIPT нижче.
													if (!document.querySelector('#{ELEM_ID}'.replace('{ELEM_ID}', StyleBlockID)))
														{
															var StyleBlock = document.createElement('STYLE');
															StyleBlock.id = StyleBlockID;

															StyleBlock.innerHTML = [
																											'.tcast_sim_read_later_popup',
																											'		{',
																											'			z-index: 100000;',
																											'			width: 30%;',
																											' 		max-width: 400px;',
																											'			overflow-y: auto;',
																											'			position: fixed;',
																											'			bottom: 5px;',
																											'			right: 5px;',
																											'			background-color: white;',
																											'			opacity: 0.98;',
																											'			color: #484848;',
																											'			box-shadow: 2px 2px 5px grey;',
																											'			font-family: Arial !important;',
																											'		}',

																											'.tcast_sim_read_later_popup *',
																											'		{',
																											'			all: initial;',
																											'			color: inherit;',
																											'			font-family: inherit;',
																											'			font-size: inherit;',
																											'		}',

																											'.tcast_sim_read_later_popup table',
																											' 	{ display: table; }',

																											'.tcast_sim_read_later_popup tbody',
																											'		{ display: table-row-group; }',
																											
																											'.tcast_sim_read_later_popup tr',
																											'		{ display: table-row; }',

																											'.tcast_sim_read_later_popup td',
																											' 	{ display: table-cell; }',

																											'.tcast_sim_read_later_popup div',
																											'		{ display: block; }',

																											'.tcast_popup_header',
																											'		{',
																											'			margin: 0px 0px 5px 0px;',
																											'			width: 100%;',
																											'			border-spacing: 0px;',
																											'			border-width: 0px;',
																											'		}',

																											'.tcast_popup_logo',
																											'		{',
																											'			width: 16px;',
																											'			height: 16px;',
																											'			margin-top: -3px;',
																											'			vertical-align: middle;',
																											'			filter: none !important;',
																											'		}',

																											'.tcast_sim_read_later_popup .tcast_close_btn',
																											'		{',
																											'			width: 45px;',
																											'			line-height: 30px;',
																											'			text-align: center;',
																											'			vertical-align: top;',
																											'			font-weight: bold;',
																											'			font-size: 16px !important;',
																											'		}',

																											'.tcast_sim_read_later_popup .tcast_close_btn:hover',
																											'		{ color: #949494; }',

																											'.tcast_sim_read_later_bkmark_list',
																											'		{',
																											'			margin: 0px 5px 10px 5px;',
																											'			max-height: 300px;',
																											' 		overflow-y: auto;',
																											'			font-size: 12px !important;',
																											'		}',
																											
																											'.tcast_read_later_bkmark_link',
																											'		{',
																											'			color: inherit !important;',
																											'			text-decoration: none !important;',
																											'		}',

																											'.tcast_read_later_bkmark_link:hover',
																											'		{ text-decoration: underline !important; }',

																											'.tcast_read_later_bkmark',
																											'		{',
																											'			margin: 0px 0px 10px;',
																											' 		font-weight: bold;',
																											'			cursor: pointer;',
																											'		}',

																											'.tcast_read_later_bkmark_link:hover .new_tab_icon',
																											'		{ display: inline-block; }',

																											'.new_tab_icon {',
																											'			display: none;',
																											'			box-sizing: border-box;',
																											'			position: relative;',
																											'			width: 10px;',
																											'			height: 10px;',
																											'			margin-left: 7px;',
																											'			box-shadow:',
																											//		Тут треба встановити окремі 
																											//	кольори, щоб була відповідність 
																											//	із загальним кольором 
																											//	tcast_sim_read_later_popup.
																											//		Чомусь тут треба обрати 
																											//	кольори світлійші.
																											//		Можливо це оптична ілюзія.
																											'				-2px 2px 0 0 #606060,',
																											'				-4px -4px 0 -2px #606060,',
																											'				4px 4px 0 -2px #606060;',
																											'				cursor: pointer;',
																											'	}',

																											'	.new_tab_icon::after,',
																											'	.new_tab_icon::before {',
																											'			content: "";',
																											'			display: block;',
																											'			box-sizing: border-box;',
																											'			position: absolute;',
																											'			right: -2px;',
																											'	}',

																											'	.new_tab_icon::before {',
																											'			transform: rotate(-45deg);',
																											'			width: 10px;',
																											'			height: 2px;',
																											'			top: 2px;',
																											'			border: solid 1px;',
																											//		А тут навпаки, треба обрати
																											//	темнійший колір, щоб була 
																											//	відповідність з кольором 
																											//	tcast_sim_read_later_popup.
																											//		Тут причина більш явна.
																											//	При повороті створюються 
																											//	перехідні пікселі зглажування, 
																											//	які більш світлі.
																											'			color: #353535;',
																											'	}',

																											'	.new_tab_icon::after {',
																											'			width: 6px;',
																											'			height: 6px;',
																											'			border-right: 2px solid;',
																											'			border-top: 2px solid;',
																											'			top: -2px;',
																											'			color: #606060;',
																											'	}'
																										].join('');

															document.head.appendChild(StyleBlock);
														}

													var ExtScriptBlockID = 'tcast_code';

													if (!document.querySelector('#{ELEM_ID}'.replace('{ELEM_ID}', ExtScriptBlockID)))
														{
															//		Викор. окремий блок скрипту, який розміщюємо
															//	у HEAD, оскільки inline-скрипт розбирається як
															//	звичайний текст.
															//		Схоже, такая поведінка пов'язана з сучасними
															//	тенденціями безпеки у браузерах.
															var ScriptBlock = document.createElement('SCRIPT');

															ScriptBlock.id = ExtScriptBlockID;

															ScriptBlock.innerHTML = 
																['	function CloseSimTabReadLaterBKMarkSPopUp()',
																'			{',
																//TODO: 
																//	- тут треба ще додати умову, що на блоці 
																//		не знах. миша. Щоб він не закривався 
																//		поки користувач робить вибір.
																'				document',
																'					.querySelectorAll(\'#' + PopUpDivID + '\')',
																'						.forEach(function(AElem)',
																'											{',
																'												document.body.removeChild(AElem);',
																'											});',
																'			};',
																//		Форму автоматично закриваємо через 
																//	певний час, щоб зайвий раз не 
																//	відволікати користувача.
																'	setTimeout(function()',
																'								{',
																'									CloseSimTabReadLaterBKMarkSPopUp();',
																'								},',
																'							30000);'].join('');
															
															document.head.appendChild(ScriptBlock);
														}

													var PopUpDiv = document.createElement('DIV');

													PopUpDiv.id = PopUpDivID;
													PopUpDiv.className = 'tcast_sim_read_later_popup';
																										
													PopUpDiv.innerHTML += 	[	'<TABLE class="tcast_popup_header">',
																									'	<TBODY>',
																									'		<TR>',
																									'			<TD style="padding: 15px 0px 0px 5px;">',
																									'				<DIV style="font-weight: bold; font-size: 16px;">',
																									'					<IMG class="tcast_popup_logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5AMcEAso1gmzggAAARNJREFUaN7tmTEKwkAQRf8EwRzAgwgiaGehd/AodnaijZ13EK+ghZ1CsPE0VvlWAQsTMmFNjP6pUvzd7NuZST67RpJocXSyh8lwWPvLz0kSDqDuhYTasAgtD8t6oIkSCpH1zttSIAGz0pORhAH+MQ59Xvm97wEz7AcD16T3zc6lX/YPMItLwj7Q7W0/18SVatdiwLrltL/cxAIQgAAEIID/BmjsT0w+YA6tD4DE/HbzeaHT1aXP8zZhSqiiS1QPCEAAAhCAAAQgM1dTLI4XRCUtS0piPRt/VwYih98q0qoHBCAAAQhAAAKoEqnjfr1IG8QLkcRqOnKPsQDHN0EyUGUhFujs6bfsdNsuu4GXm3p9hRqKJ7zcSQj52GwyAAAAAElFTkSuQmCC">',
																									'					ToChunkA Smart TabS',
																									'				</DIV>',
																									'				{SUB_HEADING_BLOCK}', 
																									'			</TD>',
																									'			<TD class="tcast_close_btn" title="Close" onclick="CloseSimTabReadLaterBKMarkSPopUp();">Х</TD>',
																									'		</TR>',
																									'	</TBODY>',
																									'</TABLE>',
																									'<DIV class="tcast_sim_read_later_bkmark_list">{LIST}</DIV>'].join('');
													
													var BKMarkListHTML = '';

													var SimReadLaterBKMarkSLen = AMsg.List.length;

													if (SimReadLaterBKMarkSLen == 0)
														{
															var SubHeadingBlockHTML = "";

															BKMarkListHTML = '<DIV style="margin: 15px 0px 15px 5px; font-size: 14px; text-align: center;">No similar bookmarks for reading later</DIV>';
														}
													else
														{
															var SubHeadingBlockHTML = '<DIV style="margin: 5px 0px 10px; font-size: 14px;">Similar read later bookmarks</DIV>';

															for(var i = 0; i < SimReadLaterBKMarkSLen; i++)
																{
																	
																	BKMarkListHTML +=	(	[	'	<A class="tcast_read_later_bkmark_link" href="{BKMARK_URL}" target="_blank">',
																												'		<DIV class="tcast_read_later_bkmark">{BKMARK_TITLE}<SPAN class="new_tab_icon"></SPAN></DIV>',
																												'	</A>']
																														.join('')
																															.replace('{BKMARK_TITLE}',
																																			AMsg.List[i][0]
																																				.replace(/&/g, '&amp;')
																																				.replace(/</g, '&lt;')
																																				.replace(/>/g, '&gt;')
																																				.replace(/"/g, '&quot;'))
																															.replace('{BKMARK_URL}', AMsg.List[i][1]));
																}
														}


													PopUpDiv.innerHTML = 
														PopUpDiv.innerHTML
															.replace('{SUB_HEADING_BLOCK}', SubHeadingBlockHTML)
															.replace('{LIST}', BKMarkListHTML);

													document.body.append(PopUpDiv);
												}
											
											//		Додано за результатами відповіді -
											//	https://stackoverflow.com/questions/59914490/chrome-extensions-unchecked-runtime-lasterror-the-message-port-closed-before .
											//	"false" - щоб порт все ж таки закрився після виконання.
											//		Без цього під Chrome виникає помилка "The message port closed before a response was received.",
											//	хоча sendResponse-параметр не задано, а отже background-скрипт взагалі немає чекати на
											//	відповідь.
											//		Для Firefox цей рядок нічого не змінює.
											return false;
										});