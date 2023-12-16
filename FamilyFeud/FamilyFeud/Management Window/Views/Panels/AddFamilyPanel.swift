//
//  AddFamilyPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import FeudKit
import SwiftUI

struct AddFamilyPanel: View {
    @State private var viewmodel: AddFamilyViewModel
    var body: some View {
        PanelView("Add New Family") {
            VStack {
                HStack {
                    PlayerView("Player 1") {
                        Image(systemName: "person.circle.fill")
                            .imageScale(.large)
                    }
                    
                    PlayerView("Player 2") {
                        Image(systemName: "person.circle")
                            .imageScale(.large)
                    }
                }
                
                HStack {
                    Button("Add") { self.viewmodel.addFamily() }
                    
                    Button("Remove") { self.viewmodel.removeFamily() }
                }
            }
        }
        .frame(width: 400, height: 200, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2)
    }
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.viewmodel = AddFamilyViewModel(game: game, viewstateservice: viewstateservice, windowcontroller: windowcontroller)
    }
}

#Preview {
    AddFamilyPanel(game: FamilyFeudGame(), viewstateservice: ViewStateService(), windowcontroller: ManagementWindowController())
        .padding()
}
