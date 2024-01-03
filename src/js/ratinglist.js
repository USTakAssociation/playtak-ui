var xhttp = new XMLHttpRequest()
xhttp.onreadystatechange = function(){
	if(this.readyState == 4 && this.status == 200){
		makeratinglist(JSON.parse(xhttp.responseText))
	}
}
xhttp.open("GET",'/ratinglist.json',true)
xhttp.send()

let row
function selectRow(event){		
	let newRow = document.getElementById(location.hash.substring(1))
	if(newRow){
		newRow.className = "selected"
		newRow.scrollIntoView({ block: "center" })
		if (row && row !== newRow) {
			row.className = ""
		}
		row = newRow
	}
	if(event) {
		event.preventDefault()
	}
}
addEventListener("hashchange", selectRow, true)

function makeratinglist(data){
	let a
	const rows = []
	let rank = 1
	for(a = 0;a < data.length;a += 1){
		const datarow = data[a]
		if(datarow[1] !== 0){
			rows.push(TR(
				{id:datarow[0].replace(/ [\s\S]*$/,'')},
				TD({className:'numbercell'},datarow[4]?IMG({src:'images/bot.png',className:'bot'}):(rank++)+"."),
				TD({className:'textcell'},formatnames(datarow[0])),
				TD({className:'numbercell'},datarow[1]),
				TD({className:'fullrating numbercell'},datarow[2]),
				TD({className:'numbercell'},datarow[3])
			))
		}
	}
	let table = TABLE(
		THEAD(TR({style:{textAlign:'left'}},TH('Rank'),TH('Player'),TH('Rating'),TH('Active rating'),TH('Games'))),
		TBODY(rows)
	)
	table.onclick = event => {
    if(event.target.tagName === "TD" && !event.target.previousSibling){
      location.hash = event.target.parentNode.id
		}
  }
	document.getElementById('|content').appendChild(DIV({style:{display:'inline-block'}},table))
	if(window.location.hash) selectRow()
}

function formatnames(names){
	names = names.split(' ')
	const outarray = []
	let a
	for(a = 0;a < names.length;a++){
		if(a === 0){
			outarray.push(A({className:'firstname',href:"/games?player_white="+names[a]+"&mirror=true",target:'_blank'},names[a]))
		}
		else{
			outarray.push(' ')
			outarray.push(A({
				className:'secondname'
				,href:"/games?player_white="+names[a]+"&mirror=true"
				,target:'_blank'
				,id:names[a]
			},names[a]))
		}
	}
	return FRAGMENT(outarray)
}
