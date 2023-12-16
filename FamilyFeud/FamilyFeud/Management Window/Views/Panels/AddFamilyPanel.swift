//
//  AddFamilyPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import FeudKit
import SwiftUI

struct AddFamilyPanel: View {
    @ObservedObject private var viewmodel: AddFamilyViewModel
    
    var body: some View {
        PanelView("Add New Family") {
            VStack {
                HStack {
                    Button {
                        self.viewmodel.familyName = self.viewmodel.matchmanager.player1?.displayName ?? "Team 1"
                    } label: {
                        PlayerView(self.viewmodel.matchmanager.player1?.displayName) {
                            self.viewmodel.matchmanager.player1Image
                                .resizable()
                                .scaledToFit()
                        }
                    }
                    .buttonStyle(.plain)
                    .border(self.viewmodel.familyName == (self.viewmodel.matchmanager.player1?.displayName ?? "Team 1") ? .blue : .clear)
                    
                    Button {
                        self.viewmodel.familyName = self.viewmodel.matchmanager.player2?.displayName ?? "Team 2"
                    } label: {
                        PlayerView(self.viewmodel.matchmanager.player2?.displayName) {
                            self.viewmodel.matchmanager.player2Image
                                .resizable()
                                .scaledToFit()
                        }
                    }
                    .buttonStyle(.plain)
                    .border(self.viewmodel.familyName == (self.viewmodel.matchmanager.player2?.displayName ?? "Team 2") ? .blue : .clear)
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
    
    init(matchmanager: MatchManager, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.viewmodel = AddFamilyViewModel(matchmanager: matchmanager, windowcontroller: windowcontroller, viewstateservice: viewstateservice)
    }
}

#Preview {
    AddFamilyPanel(matchmanager: MatchManager(), viewstateservice: ViewStateService(), windowcontroller: ManagementWindowController())
        .padding()
}
