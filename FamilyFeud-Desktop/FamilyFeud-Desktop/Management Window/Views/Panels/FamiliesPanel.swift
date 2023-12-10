//
//  FamiliesPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/2/23.
//

import FeudKit
import SwiftUI

struct FamiliesPanel: View {
    @State private var viewmodel: FamiliesViewModel
    var body: some View {
        PanelView("Families") {
            VStack(spacing: 18) {
                Table(self.viewmodel.families, selection: self.$viewmodel.selectedFamilyId) {
                    TableColumn("Family", value: \.familyName)
                    TableColumn("Points", value: \.points.description)
                }
                
                    Button("Select") { self.viewmodel.select() }
            }
        }
        .padding()
        .frame(width: 400, height: 400, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
    }
    
    init(game: FamilyFeudGame, viewstateservice: ViewStateService, windowcontroller: ManagementWindowController) {
        self.viewmodel = FamiliesViewModel(game: game, viewstateservice: viewstateservice, windowcontroller: windowcontroller)
    }
}

#Preview {
    FamiliesPanel(game: FamilyFeudGame(), viewstateservice: ViewStateService(), windowcontroller: ManagementWindowController())
}
