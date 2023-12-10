//
//  PlayControlPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/2/23.
//

import FeudKit
import SwiftUI

struct PlayControlPanel: View {
    @State private var viewmodel: PlayControlViewModel
    @State private var viewstateservice: ViewStateService
    var body: some View {
        PanelView("Play Control") {
            VStack {
                HStack {
                    Button("Select Question") { self.viewmodel.selectQuestion() }
                        .disabled(!self.viewmodel.questionEnabled)
                    
                    Button("Face Off") { self.viewmodel.faceOff() }
                        .disabled(!self.viewmodel.faceOffEnabled)
                    
                    Button("Family Play") { self.viewmodel.familyPlay() }
                        .disabled(!self.viewmodel.familyPlayEnabled)
                }
                
                HStack {
                    Button("Family Steal") { self.viewmodel.familySteal() }
                        .disabled(!self.viewmodel.familyStealEnabled)
                    
                    Button("Allocate Points") { self.viewmodel.allocatePoints() }
                        .disabled(!self.viewmodel.allocateEnabled)
                    
                    Button("Reveal Answers") { self.viewmodel.revealAnswers() }
                        .disabled(!self.viewmodel.revealEnabled)
                }
            }
        }
        .frame(width: 400, height: 200, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
        .onChange(of: self.viewstateservice.playControlPanelEnabled) {
            self.viewmodel.enableButtons() }
    }
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.viewmodel = PlayControlViewModel(windowcontroller: windowcontroller, game: game, viewstateservice: viewstateservice)
        self.viewstateservice = viewstateservice
    }
}

#Preview {
    PlayControlPanel(game: FamilyFeudGame(), viewstateservice: ViewStateService(), windowcontroller: ManagementWindowController())
}
