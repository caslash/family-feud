//
//  StateControlPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import FeudKit
import SwiftUI

struct StateControlPanel: View {
    @State private var viewmodel: StateControlViewModel
    
    var body: some View {
        PanelView("State Control") {
            VStack(spacing: 18) {
                Button("New Game") { self.viewmodel.startGame() }
                
                Button("Manage Families") { }
                
                Button("Load Question Set") { self.viewmodel.loadQuestions() }
                
                Button("Initialize Game") { }
                
                Button("Play Game") { }
                
                Button("End Game") { }
                
                Button("Fast Money") { }
            }
        }
        .frame(width: 200, height: 400, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
    }
    
    init(game: FamilyFeudGame) {
        self.viewmodel = StateControlViewModel(game: game)
    }
}

#Preview {
    StateControlPanel(game: FamilyFeudGame())
}
